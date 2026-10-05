"""Download MaleCNS sources; never retain an unverified download as a source."""

import base64
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
from urllib.request import urlopen

DATA_DIR = Path(__file__).resolve().parent
CHUNK_BYTES = 8 * 1024 * 1024


def digest(path: Path, algorithm: str) -> bytes:
    with path.open('rb') as source:
        return hashlib.file_digest(source, algorithm).digest()


def matches(path: Path, expected: dict) -> bool:
    return (
        path.is_file()
        and path.stat().st_size == expected['bytes']
        and base64.b64encode(digest(path, 'md5')).decode('ascii') == expected['md5Base64']
    )


def main() -> None:
    config = json.loads((DATA_DIR / 'config/whole-cns-v1.json').read_text())
    cache = DATA_DIR / '.cache'
    cache.mkdir(exist_ok=True)
    retrieval_path = cache / 'retrieval.json'
    retrieval = json.loads(retrieval_path.read_text()) if retrieval_path.exists() else {}
    for expected in config['files'].values():
        name = expected['name']
        target = cache / name
        skipped = matches(target, expected)
        if skipped:
            print(f'Skipping verified source: {name}', flush=True)
        else:
            partial = target.with_name(name + '.part')
            print(f'Downloading {name} ({expected["bytes"]:,} bytes)', flush=True)
            try:
                with urlopen(config['baseUrl'] + name, timeout=60) as response, partial.open('wb') as output:
                    while chunk := response.read(CHUNK_BYTES):
                        output.write(chunk)
                if not matches(partial, expected):
                    raise ValueError(f'{name}: size or MD5 mismatch; expected {expected["bytes"]} bytes and {expected["md5Base64"]}')
                partial.replace(target)
            finally:
                partial.unlink(missing_ok=True)
        old_date = retrieval.get(name, {}).get('retrievedOn') if skipped else None
        retrieval[name] = {
            'retrievedOn': old_date or datetime.now(timezone.utc).date().isoformat(),
            'sha256': digest(target, 'sha256').hex(),
        }
        temporary = retrieval_path.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(retrieval, indent=2) + '\n', encoding='utf-8')
        temporary.replace(retrieval_path)
        print(f'Verified {name}: SHA-256 {retrieval[name]["sha256"]}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        sys.exit(f'Download failed: {error}')
