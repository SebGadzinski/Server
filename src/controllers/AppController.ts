/**
 * @file Controller for application needs
 * @author Sebastian Gadzinski
 */
import express from 'express';
import Result from '../classes/Result';
import config from '../config';
import AppService from '../services/AppService';

class AppController {
  public checkForUpdate(req: any, res: any) {
    AppService.checkForUpdate(req.body.currentVersion)
      .then((result: Result) => res.status(result.status).send(result))
      .catch((errorMessage: Error) =>
        res
          .status(500)
          .send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  // TODO: see if you can get this to work so that all downloads are streamlined through here
  public download(req: any, res: any) {
    try {
      const filePath = `${config.appVersionDirectory}/${req.params?.version}/dist.zip`;

      // Check if the file exists
      if (AppService.checkIfFileExists(filePath)) {
        // If file exists, set headers and pipe the read stream to the response
        res
          .status(200)
          .header('Content-Type', 'application/zip')
          .header('Content-Disposition', `attachment; filename=dist.zip`)
          .sendFile(filePath);
      } else {
        // If file doesn't exist, send 404 status and error message
        res
          .status(404)
          .send(new Result({ message: 'File not found', success: false }));
      }
    } catch (err) {
      res
        .status(404)
        .send(new Result({ message: err.toString(), success: false }));
    }
  }

  public getLatestVersion(req: any, res: any) {
    AppService.getLatestVersion()
      .then((result: Result) => res.status(result.status).send(result))
      .catch((errorMessage: Error) =>
        res
          .status(500)
          .send(new Result({ message: errorMessage.message, success: false }))
      );
  }

  public updateNotificationSubscription(req: any, res: any) {
    AppService.updateNotificationSubscription(
      req.user?.data?.id,
      req.body?.token,
      req.body?.enable
    )
      .then((data: any) => res.send(new Result({ data })))
      .catch((errorMessage: Error) =>
        res.send(new Result({ message: errorMessage.message, success: false }))
      );
  }
}

export default new AppController();
