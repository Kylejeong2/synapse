import { describe, expect, it } from 'vitest';
import { DEFAULT_TOKEN_PRICING_ROWS } from '../convex/defaultTokenPricing';
import { MODELS } from '../src/lib/constants/models';

describe('token pricing seed coverage', () => {
	it('covers all enabled chat models', () => {
		const configuredModels = Object.keys(MODELS).sort();
		const seededModels = DEFAULT_TOKEN_PRICING_ROWS.map((row) => row.model).sort();

		expect(seededModels).toEqual(configuredModels);
	});
});
