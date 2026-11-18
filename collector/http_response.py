"""Bounded, complete JSON responses for metadata and simulation transports."""
from http.client import HTTPException
import json
import re


def read_json_response(response, limit):
    if response.status != 200:
        raise ValueError('Response is not a confirmed acknowledgment.')
    headers = getattr(response, 'headers', {})
    length = headers.get('Content-Length')
    expected = None
    if length is not None:
        # Never accept an ambiguous framing declaration or allocate from its value.
        lengths = headers.get_all('Content-Length') if hasattr(headers, 'get_all') else [length]
        if len(lengths) != 1 or headers.get('Transfer-Encoding') is not None:
            raise ValueError('Response framing is ambiguous.')
        if not re.fullmatch(r'[0-9]{1,9}', length.strip()):
            raise ValueError('Invalid response length.')
        expected = int(length)
        if expected > limit:
            raise ValueError('Response exceeds the size limit.')
    try:
        # read(n) can return early at EOF without raising IncompleteRead even when
        # Content-Length promised more bytes. Validate the actual length too.
        raw = response.read(limit + 1)
        if len(raw) > limit or (expected is not None and len(raw) != expected):
            raise ValueError('Incomplete or oversized response.')
        return json.loads(raw)
    except (HTTPException, ValueError, UnicodeError):
        raise ValueError('Response is not complete, bounded JSON.') from None
