import pdfplumber
import re
from typing import List, Dict, Tuple, Any, Union
import logging
import warnings
from collections import Counter
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
import spacy
from rapidfuzz import fuzz
import textstat
from datetime import datetime
import json
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
from textblob import TextBlob
import os
import PyPDF2
import pdf2image
import pytesseract
from pyresparser import ResumeParser

# Configure logging
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Filter specific warnings
warnings.filterwarnings('ignore', message="Can't initialize NVML")
warnings.filterwarnings('ignore', category=UserWarning, module='nltk')

# Download NLTK data silently if needed


def download_nltk_data():
    """Download required NLTK data silently."""
    try:
        nltk.data.find('tokenizers/punkt')
        nltk.data.find('corpora/stopwords')
        nltk.data.find('averaged_perceptron_tagger')
    except LookupError:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            nltk.download('punkt', quiet=True)
            nltk.download('stopwords', quiet=True)
            nltk.download('averaged_perceptron_tagger', quiet=True)


# Download NLTK data
download_nltk_data()

# Load spaCy model


def load_spacy_model():
    """Load spaCy model with better error handling."""
    try:
        return spacy.load("en_core_web_lg")
    except OSError:
        logger.info("Downloading spaCy model...")
        import subprocess
        subprocess.run(["python", "-m", "spacy", "download", "en_core_web_lg"],
                       capture_output=True, text=True)
        return spacy.load("en_core_web_lg")


# Initialize spaCy
nlp = load_spacy_model()

# Initialize optional components


def init_language_tool():
    """Initialize LanguageTool with better error handling."""
    if not os.environ.get('DISABLE_LANGUAGE_TOOL'):
        try:
            import language_tool_python
            tool = language_tool_python.LanguageTool('en-US')
            logger.info("LanguageTool initialized successfully")
            return tool
        except Exception as e:
            logger.warning(
                f"LanguageTool initialization failed (optional). Using fallback method. Error: {str(e)}")
    return None


language_tool = init_language_tool()


class ATSResumeScorer:
    def __init__(self):
        """Initialize the ATS Resume Scorer with better error handling."""
        try:
            self.stop_words = set(stopwords.words('english'))
            self.initialize_scoring_components()
            self.weights = {
                'section': 20,
                'keywords': 30,
                'content': 25,
                'formatting': 15,
                'experience': 10
            }
            self.experience_levels = {
                'no_experience': 0,
                'less_than_3': 1,
                '3_to_5': 2,
                '5_to_10': 3,
                '10_plus': 4
            }
            self.nlp = spacy.load("en_core_web_sm")
            self.keyword_extractor = KeywordExtractor()
            self.grammar_checker = GrammarChecker()
            self.skill_matcher = SkillMatcher()
            self.experience_analyzer = ExperienceAnalyzer()
            self.achievement_extractor = AchievementExtractor()
            logger.info("ATS Resume Scorer initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing ATS Resume Scorer: {str(e)}")
            raise

    def initialize_scoring_components(self):
        """Initialize all scoring components."""
        self.key_sections = {
            'contact_info': ['contact', 'address', 'phone', 'email'],
            'summary': ['summary', 'profile', 'objective'],
            'experience': ['experience', 'work history', 'employment'],
            'education': ['education', 'academic', 'qualifications'],
            'skills': ['skills', 'competencies', 'expertise'],
            'certifications': ['certifications', 'certificates', 'licenses']
        }
        self.required_sections = ['contact_info',
                                  'experience', 'education', 'skills']
        self.optimal_length = {
            'summary': (3, 5),  # sentences
            'experience': (3, 5),  # bullet points per role
            'skills': (10, 20),  # total skills
            'total': (1, 2)  # pages
        }
        self.action_verbs = {
            'leadership': ['led', 'managed', 'directed', 'supervised', 'coordinated', 'oversaw', 'guided', 'mentored'],
            'achievement': ['achieved', 'improved', 'increased', 'reduced', 'optimized', 'enhanced', 'boosted', 'maximized'],
            'technical': ['developed', 'implemented', 'designed', 'engineered', 'programmed', 'built', 'created', 'architected'],
            'communication': ['presented', 'communicated', 'collaborated', 'negotiated', 'facilitated', 'advised', 'consulted', 'influenced']
        }
        self.weak_words = set([
            "responsible for", "duties included", "worked on", "helped with", "assisted",
            "attempted to", "tried to", "was part of", "participated in", "involved in",
            "familiar with", "exposure to", "knowledge of", "understanding of", "aware of"
        ])
        self.skills_keywords = set([
            "python", "java", "javascript", "react", "node", "sql", "aws", "docker",
            "kubernetes", "excel", "tableau", "powerbi", "tensorflow", "pytorch", "ml",
            "ai", "css", "html", "git", "agile", "scrum", "leadership", "project management",
            "machine learning", "deep learning", "data analysis", "data science", "cloud computing",
            "devops", "ci/cd", "rest api", "microservices", "system design", "architecture"
        ])
        self.quantifiable_indicators = [
            r'\d+%', r'\d+\+', r'\$\d+', r'\d+x', r'\d+\.\d+', r'\d+ million',
            r'\d+ billion', r'\d+ thousand', r'\d+ hours', r'\d+ days', r'\d+ weeks',
            r'\d+ months', r'\d+ years'
        ]

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF file."""
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text = ""
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text
                if text.strip():
                    return text
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
        # Fallback to OCR if no text was extracted
        try:
            images = pdf2image.convert_from_path(pdf_path)
            ocr_text = ""
            for image in images:
                ocr_text += pytesseract.image_to_string(image)
            return ocr_text
        except Exception as e:
            logger.error(f"OCR fallback failed: {str(e)}")
            return ""

    def identify_sections(self, text: str) -> Dict[str, str]:
        """Identify and extract different sections from resume text."""
        sections = {section: '' for section in self.key_sections.keys()}
        lines = text.split('\n')
        current_section = None
        current_content = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check for section headers
            for section, keywords in self.key_sections.items():
                if any(keyword in line.lower() for keyword in keywords):
                    if current_section and current_content:
                        sections[current_section] = '\n'.join(current_content)
                    current_section = section
                    current_content = []
                    break
            else:
                if current_section:
                    current_content.append(line)

        # Add the last section
        if current_section and current_content:
            sections[current_section] = '\n'.join(current_content)

        return sections

    def calculate_section_scores(self, sections: Dict[str, str]) -> Dict[str, float]:
        """Calculate scores for each section."""
        scores = {}

        # Check for required sections
        for section in self.required_sections:
            scores[f"{section}_presence"] = 1.0 if section in sections else 0.0

        # Analyze content quality
        for section, content in sections.items():
            if section == 'summary':
                sentences = len(re.split(r'[.!?]+', content))
                scores['summary_length'] = min(
                    1.0, sentences / self.optimal_length['summary'][1])

            elif section == 'experience':
                bullet_points = len(re.findall(r'•|\d+\.', content))
                scores['experience_bullets'] = min(
                    1.0, bullet_points / (self.optimal_length['experience'][1] * 3))

            elif section == 'skills':
                skills = re.findall(
                    r'[A-Za-z0-9\s]+(?:\s*,\s*[A-Za-z0-9\s]+)*', content)
                scores['skills_count'] = min(
                    1.0, len(skills) / self.optimal_length['skills'][1])

        return scores

    def check_formatting(self, text: str) -> Dict[str, float]:
        """Check resume formatting and structure."""
        formatting_scores = {
            'has_bullet_points': 1.0 if re.search(r'•|\d+\.', text) else 0.0,
            'has_dates': 1.0 if re.search(r'\d{4}', text) else 0.0,
            'has_quantifiable_achievements': 1.0 if re.search(r'\d+%|\d+\+|\$\d+', text) else 0.0,
            'has_action_verbs': 1.0 if any(verb in text.lower() for verb in sum(self.action_verbs.values(), [])) else 0.0,
            'has_consistent_formatting': 1.0 if len(set(re.findall(r'[A-Z][a-z]+:', text))) > 2 else 0.0,
            'has_professional_font': 1.0 if not re.search(r'[A-Z]{3,}', text) else 0.0,
            'has_white_space': 1.0 if len(re.findall(r'\n\s*\n', text)) > 3 else 0.0,
            'has_complex_formatting': 0.0 if re.search(r'[^\x00-\x7F]', text) else 1.0,
            'has_tables': 0.0 if re.search(r'\+-+\+', text) else 1.0
        }
        return formatting_scores

    def compute_job_match_score(self, resume_text: str, job_description: str) -> float:
        """Calculate keyword match score using TF-IDF and cosine similarity."""
        try:
            if not resume_text or not job_description:
                return 0.0
            documents = [resume_text.lower(), job_description.lower()]
            tfidf = TfidfVectorizer(stop_words='english')
            tfidf_matrix = tfidf.fit_transform(documents)
            similarity = cosine_similarity(
                tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            return min(similarity, 1.0)
        except Exception as e:
            logger.error(f"Error computing job match score: {str(e)}")
            return 0.0

    def score_section_presence(self, sections: dict) -> float:
        """Calculate section presence score."""
        try:
            found = sum(1 for sec in self.required_sections if sec in sections)
            return found / len(self.required_sections)
        except Exception as e:
            logger.error(f"Error scoring section presence: {str(e)}")
            return 0.0

    def score_content_quality(self, metrics: dict) -> float:
        """Calculate content quality score."""
        try:
            score = 0
            components = 5
            score += min(1.0, metrics.get("action_verb_ratio", 0))
            score += min(1.0, metrics.get("quantified_achievements_ratio", 0))
            score += min(1.0, metrics.get("grammar_score", 0))
            score += min(1.0, metrics.get("professional_tone_score", 0))
            score += 1.0 if metrics.get("readability_score", 0) >= 40 else 0.0
            return score / components
        except Exception as e:
            logger.error(f"Error scoring content quality: {str(e)}")
            return 0.0

    def score_formatting(self, formatting_scores: dict) -> float:
        """Calculate formatting score."""
        try:
            relevant_keys = [
                "has_bullet_points",
                "has_dates",
                "has_consistent_formatting",
                "has_white_space",
                "has_professional_font"
            ]
            score = sum(formatting_scores.get(k, 0) for k in relevant_keys)
            return score / len(relevant_keys)
        except Exception as e:
            logger.error(f"Error scoring formatting: {str(e)}")
            return 0.0

    def calculate_experience_score(self, experience_level: str) -> float:
        """Calculate experience score based on provided experience level."""
        try:
            if experience_level not in self.experience_levels:
                raise ValueError(
                    f"Invalid experience level. Must be one of: {list(self.experience_levels.keys())}")

            # Calculate score based on experience level (0-1 scale)
            experience_score = self.experience_levels[experience_level] / 4.0
            return experience_score
        except Exception as e:
            logger.error(f"Error calculating experience score: {str(e)}")
            return 0.0

    def calculate_overall_score(self, section_score: float, keyword_score: float,
                                content_score: float, formatting_score: float,
                                experience_score: float) -> float:
        """Calculate the overall ATS score."""
        try:
            total = (
                section_score * self.weights['section'] +
                keyword_score * self.weights['keywords'] +
                content_score * self.weights['content'] +
                formatting_score * self.weights['formatting'] +
                experience_score * self.weights['experience']
            )
            return round(total, 2)
        except Exception as e:
            logger.error(f"Error calculating overall score: {str(e)}")
            return 0.0

    def analyze_strengths(self, text: str, scores: Dict[str, float]) -> List[str]:
        """Analyze resume strengths."""
        strengths = []

        # Check for strong action verbs
        action_verb_counts = {category: sum(1 for verb in verbs if verb in text.lower())
                              for category, verbs in self.action_verbs.items()}
        strong_categories = [cat for cat,
                             count in action_verb_counts.items() if count >= 3]
        if strong_categories:
            strengths.append(
                f"Strong use of {', '.join(strong_categories)} action verbs")

        # Check for quantifiable achievements
        if scores.get('has_quantifiable_achievements', 0) > 0.5:
            strengths.append("Good use of quantifiable achievements")

        # Check for consistent formatting
        if scores.get('has_consistent_formatting', 0) > 0.5:
            strengths.append("Consistent and professional formatting")

        # Check for white space usage
        if scores.get('has_white_space', 0) > 0.5:
            strengths.append("Good use of white space for readability")

        # Check for skills
        if scores.get('skills_count', 0) > 0.7:
            strengths.append("Comprehensive skills section")

        # Check for readability
        readability_score = textstat.flesch_reading_ease(text)
        if readability_score >= 40:
            strengths.append(f"Good readability score: {readability_score}")

        # Check for grammar
        if scores.get('grammar_score', 0) > 0.8:
            strengths.append("Strong grammar and writing style")

        # Check for professional tone
        if scores.get('professional_tone_score', 0) > 0.8:
            strengths.append("Professional and confident tone")

        # Add experience level strength
        experience_level = scores.get('experience_level', 'no_experience')
        if experience_level != 'no_experience':
            strengths.append(
                f"Relevant experience level: {experience_level.replace('_', ' ').title()}")

        return strengths

    def analyze_weaknesses(self, text: str, scores: Dict[str, float]) -> List[str]:
        """Analyze resume weaknesses."""
        weaknesses = []

        # Check for missing sections
        for section in self.required_sections:
            if scores.get(f"{section}_presence", 0) == 0:
                weaknesses.append(
                    f"Missing {section.replace('_', ' ')} section")

        # Check for content quality
        if scores.get('summary_length', 0) < 0.5:
            weaknesses.append("Summary section is too short")

        if scores.get('experience_bullets', 0) < 0.5:
            weaknesses.append("Experience section needs more bullet points")

        if scores.get('skills_count', 0) < 0.5:
            weaknesses.append("Skills section needs more entries")

        # Check formatting issues
        if scores.get('has_professional_font', 0) < 0.5:
            weaknesses.append("Excessive use of all caps")

        if scores.get('has_white_space', 0) < 0.5:
            weaknesses.append("Insufficient white space between sections")

        if scores.get('has_complex_formatting', 0) < 0.5:
            weaknesses.append("Complex formatting may affect ATS parsing")

        if scores.get('has_tables', 0) < 0.5:
            weaknesses.append("Tables may not be parsed correctly by ATS")

        # Check for weak words
        weak_word_count = sum(
            1 for word in self.weak_words if word in text.lower())
        if weak_word_count > 3:
            weaknesses.append(
                f"Found {weak_word_count} weak phrases that could be strengthened")

        # Check readability
        readability_score = textstat.flesch_reading_ease(text)
        if readability_score < 40:
            weaknesses.append(f"Low readability score: {readability_score}")

        # Check grammar
        if scores.get('grammar_score', 0) < 0.8:
            weaknesses.append("Grammar and writing style need improvement")

        # Check professional tone
        if scores.get('professional_tone_score', 0) < 0.8:
            weaknesses.append("Tone could be more professional and confident")

        # Add experience level weakness if applicable
        experience_level = scores.get('experience_level', 'no_experience')
        if experience_level == 'no_experience':
            weaknesses.append("No professional experience mentioned")

        return weaknesses

    def generate_suggestions(self, text: str, scores: Dict[str, float],
                             strengths: List[str], weaknesses: List[str]) -> Dict[str, List[str]]:
        """Generate improvement suggestions based on analysis."""
        suggestions = {
            'content': [],
            'formatting': [],
            'optimization': []
        }

        # Content suggestions
        if 'Missing contact_info section' in weaknesses:
            suggestions['content'].append(
                "Add a contact information section with email and phone")

        if 'Missing experience section' in weaknesses:
            suggestions['content'].append(
                "Add a detailed experience section with bullet points")

        if 'Missing education section' in weaknesses:
            suggestions['content'].append(
                "Include your educational background")

        if 'Missing skills section' in weaknesses:
            suggestions['content'].append(
                "Create a skills section highlighting your key competencies")

        # Formatting suggestions
        if scores.get('has_consistent_formatting', 0) < 0.5:
            suggestions['formatting'].append(
                "Use consistent formatting for section headers")

        if scores.get('has_professional_font', 0) < 0.5:
            suggestions['formatting'].append(
                "Replace all caps with bold or italics for emphasis")

        if scores.get('has_white_space', 0) < 0.5:
            suggestions['formatting'].append(
                "Add more spacing between sections for better readability")

        if scores.get('has_complex_formatting', 0) < 0.5:
            suggestions['formatting'].append(
                "Simplify formatting to improve ATS compatibility")

        if scores.get('has_tables', 0) < 0.5:
            suggestions['formatting'].append(
                "Convert tables to bullet points for better ATS parsing")

        # Optimization suggestions
        if scores.get('has_quantifiable_achievements', 0) < 0.5:
            suggestions['optimization'].append(
                "Add more quantifiable achievements (e.g., 'Increased sales by 20%')")

        if scores.get('has_action_verbs', 0) < 0.5:
            suggestions['optimization'].append(
                "Use more action verbs to describe your responsibilities")

        if scores.get('experience_bullets', 0) < 0.5:
            suggestions['optimization'].append(
                "Expand experience descriptions with more bullet points")

        # Check for weak words
        weak_word_count = sum(
            1 for word in self.weak_words if word in text.lower())
        if weak_word_count > 3:
            suggestions['optimization'].append(
                "Replace weak phrases with stronger action verbs and achievements")

        # Check readability
        readability_score = textstat.flesch_reading_ease(text)
        if readability_score < 40:
            suggestions['optimization'].append(
                "Simplify language to improve readability and ATS compatibility")

        # Check grammar
        if scores.get('grammar_score', 0) < 0.8:
            suggestions['optimization'].append(
                "Review and improve grammar and writing style")

        # Check professional tone
        if scores.get('professional_tone_score', 0) < 0.8:
            suggestions['optimization'].append(
                "Use more professional and confident language")

        return suggestions

    def score_resume(self, file_path: str, experience_level: str = 'no_experience') -> Dict[str, Any]:
        """Main function to score a resume and provide suggestions."""
        try:
            # Extract text from PDF
            text = self.extract_text_from_pdf(file_path)
            if not text or len(text.strip()) == 0:
                raise ValueError(
                    "No text could be extracted from the PDF. The file might be an image or corrupted.")

            doc = self.nlp(text)

            # Identify sections
            sections = self.identify_sections(text)

            # Calculate section scores
            section_scores = self.calculate_section_scores(sections)

            # Check formatting
            formatting_scores = self.check_formatting(text)

            # Calculate experience score
            experience_score = self.calculate_experience_score(
                experience_level)

            # Safe word count to prevent division by zero
            word_count = max(1, len(text.split()))

            # Calculate metrics with safe division
            metrics = {
                "word_count": word_count,
                "readability_score": textstat.flesch_reading_ease(text),
                "action_verb_ratio": sum(1 for verb in sum(self.action_verbs.values(), []) if verb in text.lower()) / word_count,
                "quantified_achievements_ratio": len(re.findall('|'.join(self.quantifiable_indicators), text)) / word_count,
                "skills_count": len(set(token.text.lower() for token in doc if token.text.lower() in self.skills_keywords)),
                "grammar_score": self.calculate_grammar_score(text),
                "professional_tone_score": self.calculate_professional_tone_score(text),
                "weak_word_ratio": sum(1 for word in self.weak_words if word in text.lower()) / word_count,
                "experience_level": experience_level
            }

            # Calculate component scores
            section_score = self.score_section_presence(sections)
            keyword_score = 0.5  # Default score since we're not matching against job description
            content_score = self.score_content_quality(metrics)
            formatting_score = self.score_formatting(formatting_scores)

            # Calculate final score
            final_score = self.calculate_overall_score(
                section_score, keyword_score, content_score, formatting_score, experience_score)

            # Analyze strengths and weaknesses
            strengths = self.analyze_strengths(
                text, {**section_scores, **formatting_scores, **metrics})
            weaknesses = self.analyze_weaknesses(
                text, {**section_scores, **formatting_scores, **metrics})

            # Generate suggestions
            suggestions = self.generate_suggestions(
                text, {**section_scores, **formatting_scores, **metrics}, strengths, weaknesses)

            return {
                "ats_score": final_score,
                "subscores": {
                    "section": round(section_score * 100, 2),
                    "keywords": round(keyword_score * 100, 2),
                    "content": round(content_score * 100, 2),
                    "formatting": round(formatting_score * 100, 2),
                    "experience": round(experience_score * 100, 2)
                },
                "experience_level": experience_level,
                "section_scores": {k: round(v * 100, 2) for k, v in section_scores.items()},
                "formatting_scores": {k: round(v * 100, 2) for k, v in formatting_scores.items()},
                "suggestions": suggestions,
                "strengths": strengths,
                "weaknesses": weaknesses,
                "metrics": {k: round(v, 2) if isinstance(v, float) else v for k, v in metrics.items()}
            }

        except Exception as e:
            logger.error(f"Error scoring resume: {str(e)}", exc_info=True)
            raise

    def calculate_grammar_score(self, text: str) -> float:
        """Calculate grammar score using TextBlob and custom rules."""
        try:
            # Use TextBlob for basic analysis
            blob = TextBlob(text)
            sentences = blob.sentences
            if not sentences:
                return 0.8

            # Calculate various metrics
            scores = []

            # 1. Sentence structure analysis
            for sentence in sentences:
                # Check sentence length (penalize very short or very long sentences)
                length_score = min(1.0, max(0.0, len(sentence.words) / 20))
                scores.append(length_score)

                # Check for proper capitalization
                if sentence and sentence[0].isupper():
                    scores.append(1.0)
                else:
                    scores.append(0.0)

                # Check for proper ending punctuation
                if str(sentence).strip()[-1] in '.!?':
                    scores.append(1.0)
                else:
                    scores.append(0.0)

            # 2. Word usage analysis
            words = word_tokenize(text)
            if words:
                # Check for repeated words
                word_counts = Counter(words)
                repetition_score = min(
                    1.0, 1 - (max(word_counts.values()) / len(words)))
                scores.append(repetition_score)

                # Check for proper word capitalization
                proper_caps = sum(
                    1 for w in words if w[0].isupper() and w[1:].islower())
                caps_score = min(1.0, proper_caps / len(words))
                scores.append(caps_score)

            # 3. Sentiment and subjectivity analysis
            sentiment_scores = [abs(s.sentiment.polarity) for s in sentences]
            # Lower subjectivity is better for resumes
            subjectivity_scores = [
                1 - s.sentiment.subjectivity for s in sentences]

            avg_sentiment = sum(sentiment_scores) / \
                len(sentiment_scores) if sentiment_scores else 0.5
            avg_subjectivity = sum(
                subjectivity_scores) / len(subjectivity_scores) if subjectivity_scores else 0.5

            scores.extend([avg_sentiment, avg_subjectivity])

            # 4. Readability score
            readability = textstat.flesch_reading_ease(text)
            readability_score = min(1.0, max(0.0, readability / 100))
            scores.append(readability_score)

            # Calculate final score
            final_score = sum(scores) / len(scores)
            return min(1.0, max(0.0, final_score))

        except Exception as e:
            logger.warning(f"Error calculating grammar score: {str(e)}")
            return 0.8

    def calculate_professional_tone_score(self, text: str) -> float:
        """Calculate professional tone score."""
        try:
            # Analyze sentiment
            blob = TextBlob(text)
            sentiment = blob.sentiment.polarity

            # Check for professional language
            professional_words = ['achieved', 'managed', 'led', 'developed', 'implemented',
                                  'optimized', 'increased', 'reduced', 'improved', 'created']
            professional_count = sum(
                1 for word in professional_words if word in text.lower())
            word_count = len(text.split())

            # Calculate scores
            sentiment_score = (sentiment + 1) / 2  # Normalize to 0-1
            professional_score = min(
                1, professional_count / (word_count * 0.1))

            # Combine scores
            return (sentiment_score * 0.4 + professional_score * 0.6)
        except Exception as e:
            logger.error(
                f"Error calculating professional tone score: {str(e)}")
            return 0.8

    def enhance_experience_section(self, text: str) -> str:
        """Enhance the experience section with quantifiable achievements and professional language."""
        enhanced_text = []
        lines = text.split('\n')

        for line in lines:
            if not line.strip():
                continue

            # Enhance project descriptions
            if ':' in line:
                project_name, description = line.split(':', 1)
                enhanced_desc = self._enhance_project_description(description.strip())
                enhanced_text.append(f"### {project_name.strip()}")
                enhanced_text.append(enhanced_desc)
                enhanced_text.append("")
            else:
                enhanced_text.append(line)

        return '\n'.join(enhanced_text)

    def _enhance_project_description(self, description: str) -> str:
        """Enhance project description with professional language and achievements."""
        # Add quantifiable metrics if missing
        if not any(char.isdigit() for char in description):
            if 'developed' in description.lower():
                description = f"Successfully developed and deployed {description}"
            elif 'created' in description.lower():
                description = f"Created and implemented {description}"
            elif 'built' in description.lower():
                description = f"Built and launched {description}"
                
        # Add impact statements
        if 'aim' in description.lower():
            description = description.replace('aim', 'successfully delivered')
            
        # Enhance technical stack mentions
        tech_stack = ['HTML', 'CSS', 'JAVASCRIPT', 'PYTHON', 'Dart', 'Flutter', 'Firebase']
        for tech in tech_stack:
            if tech in description:
                description = description.replace(tech, f"**{tech}**")
                
        return description

    def enhance_skills_section(self, text: str) -> str:
        """Enhance the skills section with relevant keywords and categorization."""
        enhanced_skills = []
        skills = text.split(',')

        # Group skills by category
        skill_categories = {
            'Technical': [],
            'Soft': [],
            'Tools': [],
            'Languages': []
        }

        for skill in skills:
            skill = skill.strip()
            if not skill:
                continue

            # Categorize skill
            category = self._categorize_skill(skill)
            skill_categories[category].append(skill)

        # Format enhanced skills
        for category, category_skills in skill_categories.items():
            if category_skills:
                enhanced_skills.append(f"### {category} Skills")
                enhanced_skills.append(', '.join(category_skills))
                enhanced_skills.append('')

        return '\n'.join(enhanced_skills)

    def enhance_summary_section(self, text: str) -> str:
        """Enhance the summary section with strong action verbs and achievements."""
        doc = self.nlp(text)
        enhanced_sentences = []

        for sent in doc.sents:
            enhanced_sentence = self._enhance_sentence(str(sent))
            enhanced_sentences.append(enhanced_sentence)

        return ' '.join(enhanced_sentences)

    def _enhance_bullet_point(self, text: str) -> str:
        """Enhance a single bullet point with quantifiable achievements."""
        # Extract numbers and metrics
        numbers = re.findall(r'\d+', text)
        if numbers:
            return text  # Already has quantifiable metrics

        # Add quantifiable metrics if possible
        enhanced = text
        if 'increased' in text.lower():
            enhanced = f"Increased by 25% {text.split('increased', 1)[1]}"
        elif 'reduced' in text.lower():
            enhanced = f"Reduced by 30% {text.split('reduced', 1)[1]}"
        elif 'improved' in text.lower():
            enhanced = f"Improved by 40% {text.split('improved', 1)[1]}"

        return enhanced

    def _categorize_skill(self, skill: str) -> str:
        """Categorize a skill into appropriate category."""
        skill = skill.lower()

        # Technical skills
        if any(tech in skill for tech in ['programming', 'coding', 'development', 'software', 'database', 'cloud', 'devops']):
            return 'Technical'
        # Tools
        elif any(tool in skill for tool in ['excel', 'word', 'powerpoint', 'photoshop', 'illustrator', 'jira', 'git']):
            return 'Tools'
        # Languages
        elif any(lang in skill for lang in ['english', 'spanish', 'french', 'german', 'chinese', 'japanese']):
            return 'Languages'
        # Default to Soft skills
        else:
            return 'Soft'

    def _enhance_sentence(self, sentence: str) -> str:
        """Enhance a sentence with strong action verbs and achievements."""
        # Replace weak verbs with strong ones
        verb_replacements = {
            'did': 'accomplished',
            'made': 'created',
            'helped': 'facilitated',
            'worked': 'collaborated',
            'used': 'implemented',
            'did': 'executed',
            'got': 'achieved',
            'put': 'established',
            'set': 'established',
            'took': 'assumed',
            'gave': 'provided',
            'showed': 'demonstrated',
            'told': 'communicated',
            'saw': 'observed',
            'looked': 'analyzed',
            'found': 'discovered',
            'started': 'initiated',
            'kept': 'maintained',
            'changed': 'transformed',
            'fixed': 'resolved',
            'made sure': 'ensured',
            'went': 'progressed',
            'came': 'emerged',
            'tried': 'endeavored',
            'wanted': 'aspired',
            'needed': 'required',
            'let': 'enabled',
            'felt': 'perceived',
            'seemed': 'appeared',
            'became': 'evolved'
        }

        for weak, strong in verb_replacements.items():
            sentence = re.sub(r'\b' + weak + r'\b', strong,
                              sentence, flags=re.IGNORECASE)

        return sentence

    def enhance_section_with_textblob(self, text: str) -> str:
        """Correct grammar and spelling using TextBlob, add punctuation if missing."""
        blob = TextBlob(text)
        corrected = str(blob.correct())
        # Add full stop if missing at end of lines
        lines = [line.strip() for line in corrected.split('\n') if line.strip()]
        punctuated = []
        for line in lines:
            if line and line[-1] not in '.!?':
                punctuated.append(line + '.')
            else:
                punctuated.append(line)
        return '\n'.join(punctuated)

    def enhance_resume_markdown(self, pdf_path: str) -> str:
        """Extract, enhance, and beautify resume as markdown using a custom section parser for robust formatting."""
        import re
        import language_tool_python
        tool = language_tool_python.LanguageTool('en-US')
        # Section headers to look for
        section_headers = [
            r'Summary', r'Professional Summary', r'Education', r'Achievements', r'Certifications',
            r'Skills', r'Strengths', r'Projects', r'Experience', r'Professional Experience', r'Technical Skills',
            r'Contact', r'Contact Information'
        ]
        header_regex = re.compile(r'^(%s)\s*$' % '|'.join(section_headers), re.IGNORECASE | re.MULTILINE)
        # Extract raw text from PDF
        text = self.extract_text_from_pdf(pdf_path)
        # Extract contact block (name, phone, email, LinkedIn, GitHub)
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        name = lines[0] if lines else "Candidate"
        contact_block = ''
        for i in range(1, min(6, len(lines))):
            if re.search(r'@|linkedin|github|\d{10,}', lines[i], re.IGNORECASE):
                contact_block += lines[i] + ' | '
        contact_block = contact_block.strip(' | ')
        # Find all section headers and their positions
        matches = list(header_regex.finditer(text))
        sections = {}
        for idx, match in enumerate(matches):
            start = match.end()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
            section_name = match.group(1).strip().lower()
            section_content = text[start:end].strip()
            sections[section_name] = section_content
        # Helper to format bullets
        def format_bullets(section):
            out = []
            # Split on bullets, newlines, semicolons
            items = re.split(r'[•●○\-;\n\r]+', section)
            for item in items:
                item = item.strip()
                if item:
                    out.append(f'- {item}')
            return out
        # Helper to join paragraph and grammar-correct
        def format_paragraph(section):
            para = ' '.join([l.strip() for l in section.split('\n') if l.strip()])
            return tool.correct(para)
        # Build Markdown
        md = [f"# {name}\n"]
        if contact_block:
            md.append(f"## Contact Information\n{contact_block}\n")
        # Section order
        order = [
            'summary', 'professional summary', 'experience', 'professional experience', 'projects',
            'education', 'achievements', 'certifications', 'skills', 'technical skills', 'strengths'
        ]
        seen = set()
        for key in order:
            for section_name, section_content in sections.items():
                if key == section_name and key not in seen:
                    seen.add(key)
                    header = section_name.title()
                    md.append(f"## {header}\n")
                    # Paragraph for summary, bullets for others
                    if 'summary' in key:
                        md.append(format_paragraph(section_content) + '\n')
                    elif key in ['education', 'achievements', 'certifications', 'skills', 'technical skills', 'strengths', 'projects', 'experience', 'professional experience']:
                        md.extend(format_bullets(section_content))
                        md.append('')
        # Add any remaining sections not in order
        for section_name, section_content in sections.items():
            if section_name not in seen:
                header = section_name.title()
                md.append(f"## {header}\n")
                md.extend(format_bullets(section_content))
                md.append('')
        return '\n'.join(md)


class KeywordExtractor:
    """Extract and analyze keywords from text."""

    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")
        self.stop_words = set(stopwords.words('english'))

    def extract_keywords(self, text: str) -> List[str]:
        """Extract important keywords from text."""
        doc = self.nlp(text)
        keywords = []
        for token in doc:
            if (token.pos_ in ['NOUN', 'PROPN', 'VERB'] and
                not token.is_stop and
                not token.is_punct and
                    len(token.text) > 2):
                keywords.append(token.text.lower())
        return list(set(keywords))


class GrammarChecker:
    """Check grammar and writing style."""

    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")

    def check_grammar(self, text: str) -> Dict[str, Any]:
        """Check grammar and provide suggestions."""
        doc = self.nlp(text)
        issues = []

        for sent in doc.sents:
            # Check sentence length
            if len(sent) > 30:
                issues.append(f"Long sentence: '{sent.text}'")

            # Check for passive voice
            for token in sent:
                if token.dep_ == "nsubjpass":
                    issues.append(f"Passive voice: '{sent.text}'")

        return {
            'issues': issues,
            'score': 1.0 - (len(issues) / max(1, len(list(doc.sents))))
        }


class SkillMatcher:
    """Match and categorize skills."""

    def __init__(self):
        self.skill_categories = {
            'Technical': ['programming', 'coding', 'development', 'software', 'database', 'cloud', 'devops'],
            'Soft': ['communication', 'leadership', 'teamwork', 'problem-solving', 'time management'],
            'Tools': ['excel', 'word', 'powerpoint', 'photoshop', 'illustrator', 'jira', 'git'],
            'Languages': ['english', 'spanish', 'french', 'german', 'chinese', 'japanese']
        }

    def match_skills(self, text: str) -> Dict[str, List[str]]:
        """Match skills from text to categories."""
        matched_skills = {category: []
                          for category in self.skill_categories.keys()}

        for category, keywords in self.skill_categories.items():
            for keyword in keywords:
                if keyword in text.lower():
                    matched_skills[category].append(keyword)

        return matched_skills


class ExperienceAnalyzer:
    """Analyze work experience section."""

    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")
        self.action_verbs = {
            'leadership': ['led', 'managed', 'directed', 'supervised', 'coordinated'],
            'achievement': ['achieved', 'improved', 'increased', 'reduced', 'optimized'],
            'technical': ['developed', 'implemented', 'designed', 'engineered', 'programmed'],
            'communication': ['presented', 'communicated', 'collaborated', 'negotiated', 'facilitated']
        }

    def analyze_experience(self, text: str) -> Dict[str, Any]:
        """Analyze experience section for achievements and impact."""
        doc = self.nlp(text)
        analysis = {
            'achievements': [],
            'impact_metrics': [],
            'action_verbs': {category: [] for category in self.action_verbs.keys()}
        }

        for sent in doc.sents:
            # Check for quantifiable achievements
            numbers = re.findall(r'\d+%|\d+\+|\$\d+', sent.text)
            if numbers:
                analysis['impact_metrics'].append(sent.text)

            # Check for action verbs
            for category, verbs in self.action_verbs.items():
                for verb in verbs:
                    if verb in sent.text.lower():
                        analysis['action_verbs'][category].append(sent.text)

        return analysis


class AchievementExtractor:
    """Extract and enhance achievements."""

    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")

    def extract_achievements(self, text: str) -> List[str]:
        """Extract achievements from text."""
        doc = self.nlp(text)
        achievements = []

        for sent in doc.sents:
            # Look for achievement indicators
            if any(indicator in sent.text.lower() for indicator in
                   ['achieved', 'accomplished', 'completed', 'delivered', 'implemented']):
                achievements.append(sent.text)

        return achievements

    def enhance_achievement(self, achievement: str) -> str:
        """Enhance an achievement with quantifiable metrics."""
        # Check if already has numbers
        if re.search(r'\d+', achievement):
            return achievement

        # Add quantifiable metrics based on context
        if 'increased' in achievement.lower():
            return f"Increased by 25% {achievement.split('increased', 1)[1]}"
        elif 'reduced' in achievement.lower():
            return f"Reduced by 30% {achievement.split('reduced', 1)[1]}"
        elif 'improved' in achievement.lower():
            return f"Improved by 40% {achievement.split('improved', 1)[1]}"
        elif 'saved' in achievement.lower():
            return f"Saved $10,000 {achievement.split('saved', 1)[1]}"
        elif 'completed' in achievement.lower():
            return f"Completed 100% {achievement.split('completed', 1)[1]}"

        return achievement


# Example usage:
if __name__ == "__main__":
    scorer = ATSResumeScorer()
    result = scorer.score_resume("path/to/resume.pdf", "job description text")
    print(json.dumps(result, indent=2))
