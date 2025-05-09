import torch
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import pandas as pd
import logging
from sklearn.feature_extraction.text import TfidfVectorizer
import regex as re

# Logger
logger = logging.getLogger(__name__)

# Models and vectorizer
tfidf_vectorizer = TfidfVectorizer(max_df=0.8, sublinear_tf=True)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
semantic_model = SentenceTransformer(
    'sentence-transformers/all-MiniLM-L6-v2').to(device)
logger.info(semantic_model)


def extract_job_skills(text):
    """Extract potential skills and technologies from text."""
    # Common skill-related patterns
    skill_patterns = [
        # Capitalized words (e.g., Python, JavaScript)
        r'\b[A-Z][A-Za-z0-9#+]+\b',
        # Words before Developer/Engineer
        r'\b[A-Za-z]+[\-\.]?[A-Za-z]+\b(?=\s*Developer|\s*Engineer|\s*Programmer)',
        r'\b[A-Za-z0-9]+[\-\.][A-Za-z0-9]+\b',  # Hyphenated or dotted terms
        r'\b[A-Z][A-Z0-9]+\b'  # Acronyms
    ]

    skills = set()
    for pattern in skill_patterns:
        matches = re.finditer(pattern, text)
        skills.update(match.group() for match in matches)

    return list(skills)


def calculate_skill_match_score(cv_skills, job_skills):
    """Calculate skill match score between CV and job skills."""
    if not cv_skills or not job_skills:
        return 0.0

    cv_skills_set = set(s.lower() for s in cv_skills)
    job_skills_set = set(s.lower() for s in job_skills)

    if not job_skills_set:
        return 0.0

    matching_skills = cv_skills_set.intersection(job_skills_set)
    return len(matching_skills) / len(job_skills_set)


def filter_jobs_by_keywords(jobs_df, required_keywords, exclude_keywords):
    """Filter jobs based on required and excluded keywords with skill matching."""
    if required_keywords:
        # Extract skills from required keywords
        required_skills = set(k.lower() for k in required_keywords)

        # Filter based on skill presence in description
        jobs_df = jobs_df[jobs_df['description'].apply(
            lambda desc: any(skill in desc.lower()
                             for skill in required_skills)
        )]

    if exclude_keywords:
        exclude_skills = set(k.lower() for k in exclude_keywords)
        jobs_df = jobs_df[~jobs_df['description'].apply(
            lambda desc: any(skill in desc.lower() for skill in exclude_skills)
        )]

    return jobs_df


def calculate_keyword_scores(keywords_list, job_texts):
    """Calculate keyword match scores with skill extraction."""
    if not keywords_list or not job_texts:
        return [0.0] * len(job_texts)

    # Extract skills from keywords
    keyword_skills = set(k.lower() for k in keywords_list)

    # Calculate scores based on skill presence and context
    scores = []
    for job_text in job_texts:
        job_skills = set(s.lower() for s in extract_job_skills(job_text))
        if not job_skills:
            scores.append(0.0)
            continue

        # Calculate direct matches
        matching_skills = keyword_skills.intersection(job_skills)
        direct_score = len(matching_skills) / len(keyword_skills)

        # Calculate contextual matches (skills appearing near each other)
        context_score = 0.0
        if matching_skills:
            context_windows = [job_text[i:i+100].lower()
                               for i in range(0, len(job_text), 50)]
            context_matches = sum(
                1 for window in context_windows
                if any(skill in window for skill in matching_skills)
            )
            context_score = context_matches / len(context_windows)

        # Combine scores
        scores.append(0.7 * direct_score + 0.3 * context_score)

    return scores


def calculate_tfidf_scores(cv_text, job_texts):
    if not cv_text or not job_texts:
        return [0.0] * len(job_texts)
    documents = [cv_text] + job_texts
    tfidf_matrix = tfidf_vectorizer.fit_transform(documents)
    return cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()


def calculate_semantic_scores(cv_text, job_texts):
    """Calculate semantic similarity with skill-aware weighting."""
    if not cv_text or not job_texts or job_texts == ['']:
        return [0.0] * len(job_texts)

    # Extract skills
    cv_skills = extract_job_skills(cv_text)
    job_skills_list = [extract_job_skills(text) for text in job_texts]

    # Calculate base semantic scores
    texts = [cv_text] + job_texts
    embeddings = semantic_model.encode(
        texts, convert_to_numpy=True, normalize_embeddings=True)
    cv_embedding = embeddings[0]
    job_embeddings = embeddings[1:]
    semantic_scores = [np.dot(cv_embedding, emb) for emb in job_embeddings]

    # Calculate skill match scores
    skill_scores = [calculate_skill_match_score(cv_skills, job_skills)
                    for job_skills in job_skills_list]

    # Combine scores with skill-aware weighting
    return [0.7 * sem_score + 0.3 * skill_score
            for sem_score, skill_score in zip(semantic_scores, skill_scores)]


def calculate_elite_scores(cv_text, job_texts, top_n=30, boost_factor=1.5):
    if not cv_text or not job_texts or len(job_texts) < 2:
        return [0.0] * len(job_texts)

    documents = [cv_text] + job_texts
    vectorizer = TfidfVectorizer(min_df=2, ngram_range=(1, 2))
    tfidf_matrix = vectorizer.fit_transform(documents)
    feature_names = vectorizer.get_feature_names_out()

    term_frequencies = np.asarray(tfidf_matrix.sum(axis=0)).flatten()
    cv_vector = tfidf_matrix[0].toarray().flatten()
    cv_term_indices = cv_vector.nonzero()[0]
    term_frequencies[cv_term_indices] *= boost_factor

    prob_dist_matrix = tfidf_matrix.toarray() / np.sum(tfidf_matrix.toarray(), axis=0)
    entropy = -np.sum(prob_dist_matrix *
                      np.log2(prob_dist_matrix + 1e-9), axis=0)

    combined_ranking = term_frequencies * (1 / (entropy + 1e-9))
    elite_keywords_idx = np.argsort(combined_ranking)[-top_n:]
    elite_keywords = [feature_names[idx] for idx in elite_keywords_idx]

    elite_keywords_set = set(elite_keywords)
    reduced_documents = [
        ' '.join([word for word in doc.split() if word in elite_keywords_set])
        for doc in documents
    ]

    elite_scores = calculate_semantic_scores(
        reduced_documents[0], reduced_documents[1:])
    return elite_scores


def rank_job_descriptions(jobs_df, cv_text, preferred_keywords, required_keywords=[], exclude_keywords=[]):
    """Optimized job ranking with improved performance"""
    if jobs_df.empty or 'description' not in jobs_df.columns:
        logger.warning(
            "Job DataFrame is empty or missing descriptions. Skipping ranking.")
        return jobs_df
    if not cv_text:
        logger.warning("CV text is empty or non-existent. Skipping ranking.")
        return jobs_df

    # Filter jobs first to reduce computation
    ranked_df = filter_jobs_by_keywords(
        jobs_df, required_keywords, exclude_keywords)
    if ranked_df.empty:
        return ranked_df

    # Preprocess all texts once
    job_descriptions = ranked_df['description'].tolist()

    # Calculate scores concurrently
    scores = {
        'tfidf_score': calculate_tfidf_scores(cv_text, job_descriptions),
        'sbert_similarity': calculate_semantic_scores(cv_text, job_descriptions),
        'keyword_score': calculate_keyword_scores(preferred_keywords, job_descriptions)
    }

    # Apply scores to dataframe
    for score_name, score_values in scores.items():
        ranked_df[score_name] = score_values

        # Normalize scores
        max_val = ranked_df[score_name].max()
        if max_val > 0:
            ranked_df[score_name] = ranked_df[score_name] / max_val

    # Calculate combined score with emphasis on keyword matches
    ranked_df['combined_score'] = (
        0.4 * ranked_df['keyword_score'] +
        0.4 * ranked_df['sbert_similarity'] +
        0.2 * ranked_df['tfidf_score']
    )

    # Sort and add tier with adjusted thresholds
    ranked_df = ranked_df.sort_values(by=['combined_score'], ascending=False)

    bins = [0, 0.3, 0.5, 0.7, 1]
    labels = ['Irrelevant', 'Tiny maybe', 'Mid match', 'High match']
    ranked_df['tier'] = pd.cut(
        ranked_df['combined_score'],
        bins=bins,
        labels=labels,
        include_lowest=True
    )

    return ranked_df
