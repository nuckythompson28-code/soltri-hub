"""Regenerate individual NC files and the operator ZIP from the canonical source."""
from pathlib import Path
import re
import zipfile

root=Path(__file__).resolve().parents[1]
source=(root/'programs/o0500-unit5.nc').read_text(encoding='ascii')
blocks=[block.strip() for block in source.split('%') if block.strip()]
expected={'O0500','O9050'}
assert {re.match(r'O\d+',block)[0] for block in blocks}==expected
assert len(blocks)==len(expected)
destination=root/'programs/o0500'
destination.mkdir(exist_ok=True)
guide=(root/'docs/o0500-unit5-port.md').read_bytes()
(destination/'README.txt').write_bytes(guide)
with zipfile.ZipFile(root/'programs/o0500-unit5-package.zip','w',compression=zipfile.ZIP_DEFLATED) as package:
    for block in blocks:
        program=re.match(r'O\d+',block)[0]
        data=('%\n'+block+'\n%\n').replace('\n','\r\n').encode('ascii')
        for ext in ['nc','txt']:
            name=program+'.'+ext
            (destination/name).write_bytes(data)
            package.writestr(name,data)
    package.writestr('README.txt',guide)
print('Packaged O0500 + O9050 as ASCII NC/TXT and README.txt')
