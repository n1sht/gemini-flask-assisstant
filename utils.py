import markdown
from markdown.extensions import fenced_code, tables, nl2br
from pygments import highlight
from pygments.lexers import get_lexer_by_name, guess_lexer
from pygments.formatters import HtmlFormatter
import bleach

# Allowed HTML tags for security
ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre', 'hr', 'div', 'span', 'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img'
]

ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'code': ['class'],
    'pre': ['class'],
    'span': ['class'],
    'div': ['class']
}

def format_message(text):
    """
    Convert markdown text to safe HTML with syntax highlighting
    """
    # Configure markdown with extensions
    md = markdown.Markdown(extensions=[
        'fenced_code',
        'tables',
        'nl2br',
        'toc',
        'footnotes',
        'attr_list',
        'def_list',
        'abbr',
        'md_in_html',
        'codehilite'
    ], extension_configs={
        'codehilite': {
            'css_class': 'highlight',
            'linenums': False,
            'guess_lang': True
        }
    })
    
    # Convert markdown to HTML
    html = md.convert(text)
    
    # Clean HTML for security
    clean_html = bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True
    )
    
    return clean_html

def get_code_styles():
    """
    Get CSS styles for syntax highlighting
    """
    formatter = HtmlFormatter(style='monokai')
    return formatter.get_style_defs('.highlight')