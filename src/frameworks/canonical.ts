import { EvaluationProxyAPIRequest } from '../types';

export interface CanonicalEvaluationStrategy<RequestType, ResponseType> {
  convertToQualifireEvaluationRequest(
    request: RequestType,
    response: ResponseType
  ): Promise<EvaluationProxyAPIRequest>;
}
