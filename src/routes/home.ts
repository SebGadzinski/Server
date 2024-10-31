/**
 * @file Defines all data related route patterns.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import HomeController from '../controllers/HomeController';

const router = express.Router({});

router.get('/search', HomeController.getSearchPageData);

export default router;
