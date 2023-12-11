/**
 * @file Dispatcher for user related requests.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import Result from '../classes/Result';
import User from '../models/User';
import UserService from '../services/UserService';

class UserController {
  public getAll(req: any, res: any) {
    User.find({})
      .then((users: []) => res.send(new Result({ data: users })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  public get(req: any, res: any) {
    User.find({ _id: req.params.id })
      .then((user: any) => res.send(new Result({ data: user })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  public create(req: any, res: any) {
    UserService.create({
      email: req.body.email,
      fullName: req.body.fullName,
      password: req.body.password,
      refreshToken: req.body.refreshToken,
      roles: req.body.roles
    })
      .then((user: any) => res.send(new Result({ data: user })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  public update(req: any, res: any) {
    UserService.update({
      email: req.body.email,
      fullName: req.body.fullName,
      id: req.params.id,
      password: req.body.password,
      refreshToken: req.body.refreshToken,
      role: req.body.role
    })
      .then((user: any) => res.send(new Result({ data: user })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  public delete(req: any, res: any) {
    UserService.delete(req.params.id)
      .then(() => res.send(new Result({ success: true })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }
}
export default new UserController();
