/**
 * @file Unit Test Class.
 * @author Sebastian Gadzinski
 */

import BaseTest from './BaseTest';

/**
 * Base class which wipes out database before starting test
 */
export default abstract class UnitTest extends BaseTest {
  public testName: string;

  constructor(testName: string) {
    super();
    this.testName = testName;
  }
}
