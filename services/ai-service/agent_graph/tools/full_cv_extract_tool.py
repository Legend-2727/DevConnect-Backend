from langchain_core.tools import tool
from PyPDF2 import PdfReader

@tool
def extract_full_cv_from_pdf(file_path: str) -> dict:
    """
    Extracts raw text from PDF and returns  the full original text.
    """
    with open(file_path, 'rb') as f:
        reader = PdfReader(f)
        text = "\n".join([page.extract_text() or "" for page in reader.pages])
    
    return {
        
        "original_cv_text": text  
    }
