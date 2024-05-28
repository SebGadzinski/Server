/**
 * @file Unit Test Class.
 * @author Sebastian Gadzinski
 */

import BaseTest from './BaseTest';
import { Builder, By, Key, until, WebDriver } from 'selenium-webdriver';

/**
 * Base class which wipes out database before starting test
 */
export default abstract class SelenuimTest extends BaseTest {
    public d: WebDriver;

    constructor() {
        super();
        this.d = null; // Initialize the driver to null
    }

    public async initiateDriver() {
        this.d = await new Builder().forBrowser('chrome').build();
    }

    public async click(by) {
        await this.d.findElement(by).click();
    }
}
