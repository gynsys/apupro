"""
HTML Sanitizer utilities to prevent XSS attacks.
Uses bleach to sanitize HTML content from rich text editors like Quill.
"""
from bleach import clean
from typing import Optional

# Allowed HTML tags for rich text content
ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'i', 'b',
    'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre', 'a', 'img',
    'span', 'div'
]

# Allowed HTML attributes
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'span': ['class', 'style'],
    'div': ['class', 'style'],
    'p': ['class', 'style'],
}

# Allowed CSS properties
ALLOWED_STYLES = [
    'color', 'background-color', 'font-size', 'font-weight',
    'text-align', 'text-decoration', 'margin', 'padding',
    'border', 'display', 'width', 'height'
]

def sanitize_html(html_content: Optional[str]) -> str:
    """
    Sanitize HTML content to prevent XSS attacks.

    Args:
        html_content: Raw HTML string from rich text editor

    Returns:
        Sanitized HTML string with only safe tags and attributes

    Example:
        >>> sanitize_html('<script>alert("xss")</script><p>Hello</p>')
        '<p>Hello</p>'
    """
    if not html_content:
        return ""

    return clean(
        html_content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        styles=ALLOWED_STYLES,
        strip=True,  # Remove disallowed tags instead of escaping
        strip_comments=True
    )

def sanitize_string(text: Optional[str]) -> str:
    """
    Sanitize plain text to prevent XSS (removes all HTML).

    Args:
        text: Plain text that may contain HTML

    Returns:
        Plain text with all HTML tags removed

    Example:
        >>> sanitize_string('<script>alert("xss")</script>Hello')
        'Hello'
    """
    if not text:
        return ""

    return clean(text, tags=[], attributes={}, strip=True, strip_comments=True)
