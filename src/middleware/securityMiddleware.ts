/**
 * @file Security middleware.
 * @author Sebastian Gadzinski
 */
import SecurityService from '../services/SecurityService';

const security = SecurityService.getInstance();

const IPSecurity = security.ipFilterMiddleware;

export { IPSecurity };
