import { EvaluationRequest } from '../types';

export interface CanonicalEvaluationStrategy {
  convertToQualifireEvaluationRequest(
    request: any,
    response: any
  ): EvaluationRequest;
}
