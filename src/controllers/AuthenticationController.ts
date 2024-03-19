/**
 * @file Dispatcher for authentication related requests.
 * @author Sebastian Gadzinski
 */
import RefreshTokenResponse from '../classes/RefreshTokenResponse';
import Result from '../classes/Result';
import UserData from '../classes/UserData';
import AuthenticationService from '../services/AuthenticationService';

class AuthenticationController {
  public login(req: any, res: any) {
    AuthenticationService.login(req.body.email, req.body.password)
      .then((userData: UserData) => {
        res.send(new Result({ data: userData }));
      })
      .catch((errorMessage: string) =>
        res.send(new Result({ message: errorMessage, success: false }))
      );
  }

  public signUp(req: any, res: any) {
    if (!req.user && req.body.roles) {
      req.res.send(
        new Result({
          message: 'Does not have permission to sign up user with roles',
          success: false
        })
      );
      return;
    }
    if (!req.user) {
      req.body.roles = ['user'];
    }
    if (!req.body.fullName) {
      req.body.fullName = req.body.email.split('@')[0];
    }
    AuthenticationService.signUp({
      email: req.body.email,
      fullName: req.body.fullName,
      password: req.body.password,
      roles: req.body.roles,
      refreshToken: req.body.refreshToken
    })
      .then(async (user: any) => {
        await AuthenticationService.sendEmailConfirmation(user._id);
        delete user.password;
        delete user.salt;
        res.send(new Result({ data: user }));
      })
      .catch((errorMessage: string) =>
        res.send(
          new Result({ message: errorMessage.toString(), success: false })
        )
      );
  }

  public refreshToken(req: any, res: any) {
    AuthenticationService.refreshToken(req.body.token)
      .then((data: RefreshTokenResponse) => {
        res.send(new Result({ data }));
      })
      .catch((errorMessage: string) =>
        res.send(new Result({ message: errorMessage, success: false }))
      );
  }

  public sendEmailConfirmation(req: any, res: any) {
    AuthenticationService.sendEmailConfirmation(
      req.params.id ?? req.user.data.id
    )
      .then(() => res.send(new Result({ success: true })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  public sendEmailResetPassword(req: any, res: any) {
    AuthenticationService.sendEmailResetPassword(
      req.params?.id ?? req.user?.data?.id ?? req.body?.email
    )
      .then(() => res.send(new Result({ success: true })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  public confirmEmail(req: any, res: any) {
    AuthenticationService.confirmEmail(req.params.token)
      .then(() => res.send(new Result({ success: true })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  public emailConfirmStatus(req: any, res: any) {
    if (!req?.user?.data) {
      res.send(new Result({ data: 'noUser', success: true }));
      return;
    }
    AuthenticationService.emailConfirmStatus(req?.user.data.email)
      .then((isConfirmed) => res.send(new Result({ data: isConfirmed, success: isConfirmed })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  public resetPassword(req: any, res: any) {
    AuthenticationService.resetPassword(req.params.token, req.body.password)
      .then(() => res.send(new Result({ success: true })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  public logout(req: any, res: any) {
    AuthenticationService.logout(req.params.id ?? req.user.data.id)
      .then(() => res.send(new Result({ success: true })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }
}

export default new AuthenticationController();
