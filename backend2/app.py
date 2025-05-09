import nltk
import os
import logging
import asyncio
import gc
import warnings
from typing import Any, Dict
from pathlib import Path
import base64
import tempfile
import requests
from werkzeug.exceptions import RequestEntityTooLarge
from flask_cors import CORS

from flask import Flask, request, jsonify, render_template, make_response, send_from_directory, send_file
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.utils import secure_filename

from config import Config
from src import (
    rank_job_descriptions,
    validate_and_clean_input,
    dump_ranked_jobs,
    process_job_dataframe,
    fetch_jobs_unified,
    extract_text_from_pdf,
    ATSResumeScorer,
    ResumeEnhancer
)

# Filter out specific warnings
warnings.filterwarnings('ignore', message="Can't initialize NVML")
warnings.filterwarnings('ignore', category=UserWarning, module='nltk')

# Flask app setup
app = Flask(__name__)
CORS(app, origins=[Config.CORS_DEV])
app.config.from_object(Config)

# Simple rate limiter with in-memory storage
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["50 per minute"],
    storage_uri="memory://"
)

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Ensure required directories exist
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
os.makedirs('logs', exist_ok=True)

# Download NLTK data silently
nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('averaged_perceptron_tagger', quiet=True)

enhancer = ResumeEnhancer()

@app.after_request
def add_security_headers(response):
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net https://code.jquery.com 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: https://icons.duckduckgo.com;"
        "font-src 'self' https://cdn.jsdelivr.net; "
        "connect-src 'self' https://ipapi.co; "
        "object-src 'none'; "
        "frame-ancestors 'none'; "
    )
    return response


@app.route('/', methods=['GET'])
def index():
    response = make_response("Welcome to backend2")
    response.mimetype = "text/plain"
    return response


@app.route('/search-jobs', methods=['POST'])
@limiter.limit("10 per minute")
def search_jobs():
    logger.info("foo1")
    form_input_result = validate_and_clean_input(request.form, request.files)
    logger.info("foo2")
    if isinstance(form_input_result, tuple) and form_input_result[1] == 400:
        return form_input_result

    form_input: Dict[str, Any] = form_input_result

    logger.info(
        f"Incoming request. Terms: {form_input['job_position']} - "
        f"Country: {form_input['country']['name']} - Location: {form_input['region']} - "
        f"Interval: {form_input['interval']}"
    )

    try:
        all_jobs_df = asyncio.run(fetch_jobs_unified(
            form_input["job_position"],
            form_input["country"],
            form_input["region"],
            form_input["interval"]
        ))

        if all_jobs_df.empty:
            return jsonify({
                'jobs': [],
                'message': 'No jobs found. Please try again with different terms or locations.'
            }), 200

        all_jobs_df = process_job_dataframe(all_jobs_df)
        logger.info("bar2")
        logger.info(all_jobs_df)
        ranked_jobs_df = rank_job_descriptions(
            all_jobs_df,
            form_input["resume_text"],
            form_input["preferred_keywords"],
            form_input["exclude_keywords"]
        )

        dump_ranked_jobs(ranked_jobs_df, Config.DUMP_FILE_NAME)

        ranked_jobs = ranked_jobs_df[[
            'display_title', 'display_company', 'date_posted',
            'combined_score', 'tier', 'apply_options'
        ]].head(Config.RESULTS_WANTED).to_dict(orient='records')  # type: ignore

        del all_jobs_df, ranked_jobs_df
        gc.collect()

        return jsonify({'jobs': ranked_jobs})

    except Exception as e:
        logger.error(f"Error fetching jobs: {str(e)}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred while fetching jobs.'}), 500


@app.route('/analyze-resume', methods=['POST'])
@limiter.limit("5 per minute")
def analyze_resume():
    try:
        if 'resume' not in request.files:
            return jsonify({'error': 'No resume file provided'}), 400

        resume_file = request.files['resume']
        if resume_file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        # Get experience level from form data
        experience_level = request.form.get(
            'experience_level', 'no_experience')

        # Save the file temporarily
        temp_path = os.path.join(Config.UPLOAD_FOLDER, 'temp_resume.pdf')
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        resume_file.save(temp_path)

        try:
            # Initialize ATS scorer
            scorer = ATSResumeScorer()

            # Score and enhance resume
            result = scorer.score_resume(temp_path, experience_level)

            # Generate enhanced resume markdown
            enhanced_resume = generate_enhanced_resume_markdown(result)

            return jsonify({
                'enhanced_resume': enhanced_resume,
                'analysis': result
            })

        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        logger.error(f"Error in resume analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/enhance-resume', methods=['POST'])
@limiter.limit("5 per minute")
def enhance_resume():
    try:
        # Check if we have a file upload or a URL
        if 'resume' in request.files:
            file = request.files['resume']
            if file.filename == '':
                return jsonify({'error': 'No selected file'}), 400
                
            # Save uploaded file temporarily
            temp_path = os.path.join(Config.UPLOAD_FOLDER, 'temp_resume.pdf')
            file.save(temp_path)
            
        elif request.json and 'resumeUrl' in request.json:
            # Download from URL
            resume_url = request.json['resumeUrl']
            response = requests.get(resume_url)
            if response.status_code != 200:
                return jsonify({
                    "success": False,
                    "error": "Failed to download resume"
                }), 400

            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                temp_file.write(response.content)
                temp_path = temp_file.name
        else:
            return jsonify({
                "success": False,
                "error": "No resume file or URL provided"
            }), 400

        try:
            # Process the resume using the enhancer
            result = enhancer.process_resume(temp_path)
            
            if not result["success"]:
                return jsonify({
                    "success": False,
                    "error": result.get("error", "Failed to enhance resume")
                }), 500

            return jsonify(result)

        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        logger.error(f"Error enhancing resume: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.errorhandler(RequestEntityTooLarge)
def handle_file_size_error(e):
    return jsonify({'error': 'File size exceeds the limit.'}), 413


@app.route('/healthz', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200


@app.route('/robots.txt')
def robots_txt():
    assert app.static_folder is not None
    return send_from_directory(app.static_folder, 'robots.txt')


@app.route('/api/users/job-history', methods=['GET'])
@limiter.limit("50 per minute")
def get_job_history():
    """Get job history for the user."""
    try:
        # For now, return a mock response
        # TODO: Implement actual job history storage and retrieval
        mock_job_history = [
            {
                "id": 1,
                "title": "Software Engineer",
                "company": "Tech Corp",
                "start_date": "2020-01-01",
                "end_date": "2022-12-31",
                "description": "Worked on various software projects"
            },
            {
                "id": 2,
                "title": "Senior Developer",
                "company": "Innovate Inc",
                "start_date": "2023-01-01",
                "end_date": None,
                "description": "Leading development team"
            }
        ]

        return jsonify({
            "status": "success",
            "data": mock_job_history
        })

    except Exception as e:
        logger.error(f"Error fetching job history: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Failed to fetch job history"
        }), 500


def generate_enhanced_resume_markdown(result):
    markdown = "# Enhanced Resume\n\n"

    # Add strengths
    if result.get('strengths'):
        markdown += "## Strengths\n\n"
        for strength in result['strengths']:
            markdown += f"- {strength}\n"
        markdown += "\n"

    # Add weaknesses
    if result.get('weaknesses'):
        markdown += "## Areas for Improvement\n\n"
        for weakness in result['weaknesses']:
            markdown += f"- {weakness}\n"
        markdown += "\n"

    # Add suggestions
    if result.get('suggestions'):
        markdown += "## Suggestions\n\n"
        for category, suggestions in result['suggestions'].items():
            markdown += f"### {category.capitalize()}\n\n"
            for suggestion in suggestions:
                markdown += f"- {suggestion}\n"
            markdown += "\n"

    return markdown


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
