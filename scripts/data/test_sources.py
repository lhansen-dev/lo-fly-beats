"""Regression checks for cache integrity and metadata-only IPC inspection."""

import base64
import hashlib
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import pyarrow as pa
import pyarrow.ipc as ipc

from download_sources import matches
import download_sources
from inspect_sources import batch_row_counts


class SourceTests(unittest.TestCase):
    def test_bad_download_removes_partial_file(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'config').mkdir()
            config = {'baseUrl': 'https://example.invalid/', 'files': {'annotations': {
                'name': 'source', 'bytes': 5, 'md5Base64': 'incorrect',
            }}}
            (directory / 'config/whole-cns-v1.json').write_text(json.dumps(config))
            with patch.object(download_sources, 'DATA_DIR', directory), patch.object(download_sources, 'urlopen', return_value=io.BytesIO(b'wrong')):
                with self.assertRaisesRegex(ValueError, 'size or MD5 mismatch'):
                    download_sources.main()
            self.assertFalse((directory / '.cache/source.part').exists())
            self.assertFalse((directory / '.cache/source').exists())
            self.assertFalse((directory / '.cache/retrieval.json').exists())

    def test_cache_checks_size_and_contents(self):
        with TemporaryDirectory() as temporary:
            path = Path(temporary) / 'source'
            data = b'verified bytes'
            expected = {'bytes': len(data), 'md5Base64': base64.b64encode(hashlib.md5(data).digest()).decode('ascii')}
            self.assertFalse(matches(path, expected))
            path.write_bytes(data)
            self.assertTrue(matches(path, expected))
            path.write_bytes(b'x' * len(data))
            self.assertFalse(matches(path, expected))
            path.write_bytes(data + b'x')
            self.assertFalse(matches(path, expected))

    def test_counts_compressed_dictionary_and_empty_batches(self):
        for compression in (None, 'lz4', 'zstd'):
            with self.subTest(compression=compression), TemporaryDirectory() as temporary:
                path = Path(temporary) / 'test.arrow'
                values = pa.array(['left', 'right', 'left']).dictionary_encode()
                batch = pa.record_batch([values, pa.array([1, 2, 3])], names=['side', 'id'])
                with ipc.new_file(path, batch.schema, options=ipc.IpcWriteOptions(compression=compression)) as writer:
                    writer.write_batch(batch)
                    writer.write_batch(batch.slice(0, 0))
                    writer.write_batch(batch.slice(0, 2))
                self.assertEqual(batch_row_counts(path), [3, 0, 2])


if __name__ == '__main__':
    unittest.main()
