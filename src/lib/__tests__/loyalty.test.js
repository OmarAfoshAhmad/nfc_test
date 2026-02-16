import { calculatePoints } from '../loyalty';
import cache from '@/lib/cache';

// Mock the cache module
jest.mock('@/lib/cache', () => ({
    getOrSet: jest.fn(),
    CacheKeys: { SETTINGS: 'settings' }
}));

describe('Loyalty Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculatePoints', () => {
        it('should calculate points correctly based on ratio', async () => {
            // Mock settings: 1 point for every 10 currency units
            cache.getOrSet.mockResolvedValue({
                points_ratio: 10,
                currency_symbol: '$'
            });

            const points = await calculatePoints(100);
            expect(points).toBe(10);
        });

        it('should return 0 if ratio is 0 or negative', async () => {
            cache.getOrSet.mockResolvedValue({
                points_ratio: 0
            });
            expect(await calculatePoints(100)).toBe(0);

            cache.getOrSet.mockResolvedValue({
                points_ratio: -5
            });
            expect(await calculatePoints(100)).toBe(0);
        });

        it('should handle decimal amounts by flooring', async () => {
            cache.getOrSet.mockResolvedValue({
                points_ratio: 10
            });
            // 95 / 10 = 9.5 -> 9 points
            expect(await calculatePoints(95)).toBe(9);
        });
    });
});
