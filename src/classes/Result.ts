/**
 * @file Base result for any controller (src/controllers/*) response
 * @author Sebastian Gadzinski
 */

class Result {
  public status: number;
  public data: any;
  public message: string;
  public success: boolean;

  constructor({
    status = null,
    data = null,
    message = '',
    success = true
  }: {
    status?: number;
    data?: any;
    message?: string;
    success?: boolean;
  }) {
    this.status = status;
    this.data = data;
    this.message = message;
    this.success = success;
  }
}

export default Result;
