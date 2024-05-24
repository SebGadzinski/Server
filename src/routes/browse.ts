import express from 'express';
import BrowseController from '../controllers/BrowseController';

const router = express.Router({});

router.get('/', BrowseController.getBrowsePageData);
router.get('/:categorySlug', BrowseController.getCategoryPageData);
router.get('/:categorySlug/:serviceSlug', BrowseController.getServicePageData);

export default router;
