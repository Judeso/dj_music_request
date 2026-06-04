import apiHandler from '../../api/requests.js';
import { adapt } from './_util.js';
export const handler = async (event) => adapt(apiHandler, event);
