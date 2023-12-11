/**
 * @file Base result for functions
 * @author Sebastian Gadzinski
 */

class FuncResult {
  public error?: string;
  public message?: string;

  constructor(error?: string, message?: string) {
    this.error = error;
    this.message = message ?? '';
  }
}

export default FuncResult;
