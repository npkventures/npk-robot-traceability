import unittest
from http_response import read_json_response
from test_upload_queue import http_reply


class ResponseTests(unittest.TestCase):
    def test_valid_fixed_chunked_and_close_delimited_json(self):
        raw = b'{"version":1,"duplicate":false}'
        framed = [(raw, b'Content-Length: 31\r\n'), (raw, None),
                  (b'1f\r\n'+raw+b'\r\n0\r\n\r\n', b'Transfer-Encoding: chunked\r\n')]
        for body, headers in framed:
            with self.subTest(headers=headers), http_reply(body, headers) as response:
                self.assertEqual(read_json_response(response, 31), {'version': 1, 'duplicate': False})

    def test_invalid_framing_and_json_are_rejected_without_body_details(self):
        for headers in [b'Content-Length: 100\r\n', b'Content-Length: -1\r\n',
                        b'Content-Length: broken\r\n', b'Content-Length: 999999999\r\n',
                        b'Content-Length: 2\r\nContent-Length: 20\r\n',
                        b'Content-Length: 2\r\nTransfer-Encoding: chunked\r\n']:
            with self.subTest(headers=headers), http_reply(b'{}', headers) as response:
                with self.assertRaises(ValueError):
                    read_json_response(response, 32)
        for raw in (b'{"private-detail":', b'\xffprivate-detail', b'{"ok":true}' + b' '*33):
            with http_reply(raw) as response:
                with self.assertRaises(ValueError) as error:
                    read_json_response(response, 32)
                self.assertNotIn('private-detail', str(error.exception))

    def test_incomplete_chunk_framing_rejects_even_a_complete_json_object(self):
        for raw in (b'2\r\n{}\r\n', b'10\r\n{}', b'2\r\n{}\r\nbad-chunk\r\n'):
            with http_reply(raw, b'Transfer-Encoding: chunked\r\n') as response:
                with self.assertRaises(ValueError):
                    read_json_response(response, 32)


if __name__ == '__main__':
    unittest.main()
