/**
 * @file Security middleware.
 * @author Sebastian Gadzinski
 */
import SecurityService from '../services/SecurityService';

const IPSecurity = SecurityService.ipFilterMiddleware;

export { IPSecurity };
