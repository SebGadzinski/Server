/**
 * @file Data returned from Login
 * @author Sebastian Gadzinski
 */

class SignUpRequest {
  public email: string;
  public fullName: string;
  public password: string;
  public roles: [string];
  public refreshToken: string;

  constructor({
    email,
    fullName,
    password,
    roles,
    refreshToken
  }: {
    email?: string;
    fullName?: string;
    password?: string;
    roles?: [string];
    refreshToken?: string;
  }) {
    this.email = email;
    this.fullName = fullName;
    this.password = password;
    this.roles = roles;
    this.refreshToken = refreshToken;
  }
}

export default SignUpRequest;
