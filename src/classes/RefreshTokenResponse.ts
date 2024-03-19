/**
 * @file Used with axios
 * @author Sebastian Gadzinski
 */

class RefreshTokenResponse {
  public token: string;
  public refreshToken: string;
  public user: any;

  constructor(token: string, refreshToken: string, user: any) {
    this.token = token;
    this.refreshToken = refreshToken;
    this.user = user;
  }
}

export default RefreshTokenResponse;
