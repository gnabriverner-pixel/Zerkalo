import tariffs from '../server/aiTariffs.json';
export const BUDGET_TEST_NOW=Date.parse(tariffs.captured_at)+3600000;
// Native Python tests share the JS fixture clock; an accidental capture is fatal.
export const PYTHON_BUDGET_CLOCK=`\nimport itertools\nticks=itertools.count(${BUDGET_TEST_NOW})\nm.time.time=lambda:next(ticks)/1000\nclass UnexpectedCapture(BaseException):pass\ndef no_capture(*args,**kwargs):raise UnexpectedCapture('unit_public_catalog_forbidden')\nm.subprocess.run=no_capture\n`;
