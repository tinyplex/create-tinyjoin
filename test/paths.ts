import {tmpdir} from 'node:os';
import {resolve} from 'node:path';

export const generatedTestRoot = resolve(
  tmpdir(),
  'create-tinygres-generated-test',
);
