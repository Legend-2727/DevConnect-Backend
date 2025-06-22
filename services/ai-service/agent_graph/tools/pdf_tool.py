from langchain_core.tools import tool
from PyPDF2 import PdfReader

@tool
def extract_cv_summary_from_pdf(file_path: str) -> dict:
    """
    Extracts raw text from PDF and returns it in the `summary_text` field.
    """
    with open(file_path, 'rb') as f:
        reader = PdfReader(f)
        text = "\n".join([page.extract_text() or "" for page in reader.pages])
    return { "summary_text": text[:3000] }
