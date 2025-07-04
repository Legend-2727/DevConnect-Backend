from fpdf import FPDF
import uuid, os
from langchain_core.tools import tool

@tool
def generate_pdf_from_text(improved_cv_text: str) -> str:
    """
    Save the text as a PDF and return a local file URL.
    """
    filename = f"improved_cv_{uuid.uuid4().hex}.pdf"
    filepath = os.path.join("/app/uploads/generated", filename)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    for line in improved_cv_text.splitlines():
        pdf.multi_cell(0, 8, txt=line)
    pdf.output(filepath)

    return f"file://{filepath}"          

