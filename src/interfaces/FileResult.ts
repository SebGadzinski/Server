/**
 * @file Used with mutler
 * @author Sebastian Gadzinski
 */

import multer from 'multer';

export interface FileResult {
  file: multer.File;
  errors: object;
}
