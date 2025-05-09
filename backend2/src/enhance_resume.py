import os
import json
import requests
from typing import Dict, Any, Optional
import logging
from config import Config
from .ats_scorer import ATSResumeScorer
import re

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),  # This will output to console
        logging.FileHandler('resume_enhancer.log')  # This will also save to a file
    ]
)
logger = logging.getLogger(__name__)

class ResumeEnhancer:
    def __init__(self):
        """Initialize the Resume Enhancer with Gemini API configuration."""
        self.api_key = Config.GEMINI_API_KEY
        self.api_url = f"{Config.GEMINI_API_URL}?key={self.api_key}"
        self.model = Config.GEMINI_MODEL
        logger.info("Resume Enhancer initialized with Gemini API")

    def _read_system_prompt(self) -> str:
        """Read the system prompt from file."""
        try:
            with open("system_prompt.md", "r") as f:
                return f.read()
        except Exception as e:
            logger.error(f"Error reading system prompt: {str(e)}")
            return ""

    def _format_resume_text(self, text: str) -> str:
        """
        Format the resume text for markdown rendering:
        - Double newlines for section breaks
        - Single newlines for bullet points and headers
        - No unnecessary line breaks within sentences
        """
        # Normalize line endings
        text = text.replace('\r\n', '\n').replace('\r', '\n')

        # Replace literal '\\n\\n' with real double newlines (section breaks)
        text = text.replace('\\n\\n', '\n\n')

        # Replace literal '\\n' with a placeholder
        text = text.replace('\\n', '[NEWLINE]')

        # Split into lines for processing
        lines = text.split('[NEWLINE]')

        formatted_lines = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # If line is a markdown header or bullet, keep as is
            if re.match(r'^(#|\*|\-|\d+\.) ', line):
                formatted_lines.append(line)
            else:
                # Otherwise, join with a space (for wrapped sentences)
                if formatted_lines and not formatted_lines[-1].endswith('\n\n'):
                    formatted_lines[-1] += ' ' + line
                else:
                    formatted_lines.append(line)

        # Join lines, then fix double newlines for section breaks
        formatted_text = '\n'.join(formatted_lines)
        formatted_text = re.sub(r'\n{3,}', '\n\n', formatted_text)  # No more than 2 newlines

        return formatted_text.strip()

    def _create_prompt(self, resume_text: str) -> str:
        """Create the prompt for the Gemini model."""
        system_prompt = self._read_system_prompt()
        return f"{system_prompt}\n\nResume Content:\n{resume_text}\n\nEnhanced Resume:"

    def enhance_resume(self, resume_text: str) -> Dict[str, Any]:
        """
        Enhance the resume using Gemini API.
        
        Args:
            resume_text (str): The text content of the resume
            
        Returns:
            Dict[str, Any]: Dictionary containing enhanced resume and metadata
        """
        try:
            # Format the resume text
            formatted_text = self._format_resume_text(resume_text)
            logger.info("Formatted text before sending to API:")
            logger.info("-" * 50)
            logger.info(formatted_text)
            logger.info("-" * 50)
            
            # Create the prompt
            prompt = self._create_prompt(formatted_text)
            
            # Prepare the request payload
            payload = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }]
            }
            
            # Call Gemini API
            logger.info("Sending request to Gemini API...")
            response = requests.post(
                self.api_url,
                headers={'Content-Type': 'application/json'},
                json=payload
            )
            
            if response.status_code != 200:
                logger.error(f"API request failed with status {response.status_code}")
                logger.error(f"Response: {response.text}")
                raise Exception(f"API request failed with status {response.status_code}: {response.text}")
            
            # Parse the response
            response_data = response.json()
            
            # Extract the enhanced resume from the response
            if 'candidates' in response_data and response_data['candidates']:
                enhanced_resume = response_data['candidates'][0]['content']['parts'][0]['text']
                logger.info("Successfully received response from Gemini API")
            else:
                logger.error("Invalid response format from Gemini API")
                logger.error(f"Response data: {response_data}")
                raise Exception("Invalid response format from Gemini API")
            
            # Format the enhanced resume
            enhanced_resume = self._format_resume_text(enhanced_resume)
            logger.info("Enhanced resume after formatting:")
            logger.info("-" * 50)
            logger.info(enhanced_resume)
            logger.info("-" * 50)
            
            return {
                "success": True,
                "data": {
                    "enhancedResume": enhanced_resume,
                    "format": "markdown"
                }
            }
            
        except Exception as e:
            logger.error(f"Error enhancing resume: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def process_resume(self, pdf_path: str) -> Dict[str, Any]:
        """
        Process a resume PDF file and return the enhanced version.
        
        Args:
            pdf_path (str): Path to the PDF file
            
        Returns:
            Dict[str, Any]: Dictionary containing enhanced resume and metadata
        """
        try:
            logger.info(f"Processing resume from PDF: {pdf_path}")
            
            # Extract text from PDF (using existing method from ATS scorer)
            scorer = ATSResumeScorer()
            resume_text = scorer.extract_text_from_pdf(pdf_path)
            
            if not resume_text:
                logger.error("Could not extract text from PDF")
                raise ValueError("Could not extract text from PDF")
            
            # Log the extracted text
            logger.info("Extracted text from PDF:")
            logger.info("-" * 50)
            logger.info(resume_text)
            logger.info("-" * 50)
            
            # Enhance the resume
            return self.enhance_resume(resume_text)
            
        except Exception as e:
            logger.error(f"Error processing resume: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            } 