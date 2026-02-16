// Currency mapping - name to symbol
export const CURRENCIES = [
    { code: 'EUR', name: 'Euro', symbol: '€', nameAr: 'يورو' },
    { code: 'USD', name: 'US Dollar', symbol: '$', nameAr: 'دولار أمريكي' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', nameAr: 'ريال سعودي' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', nameAr: 'درهم إماراتي' },
    { code: 'GBP', name: 'British Pound', symbol: '£', nameAr: 'جنيه إسترليني' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', nameAr: 'ين ياباني' },
    { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', nameAr: 'دينار كويتي' },
    { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', nameAr: 'ريال قطري' },
    { code: 'EGP', name: 'Egyptian Pound', symbol: 'ج.م', nameAr: 'جنيه مصري' },
    { code: 'TRY', name: 'Turkish Lira', symbol: '₺', nameAr: 'ليرة تركية' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', nameAr: 'روبية هندية' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', nameAr: 'فرنك سويسري' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', nameAr: 'يوان صيني' },
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽', nameAr: 'روبل روسي' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', nameAr: 'ريال برازيلي' },
    { code: 'MXN', name: 'Mexican Peso', symbol: '$', nameAr: 'بيزو مكسيكي' },
    { code: 'KRW', name: 'South Korean Won', symbol: '₩', nameAr: 'وون كوري' },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', nameAr: 'دولار سنغافوري' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', nameAr: 'دولار أسترالي' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', nameAr: 'دولار كندي' },
];

/**
 * Get currency symbol from code or name
 * @param {string} input - Currency code, name, or symbol
 * @returns {string} - Currency symbol
 */
export function getCurrencySymbol(input) {
    if (!input) return '€';

    const inputLower = input.toLowerCase().trim();

    // First check if input is already a symbol
    const bySymbol = CURRENCIES.find(c => c.symbol === input);
    if (bySymbol) return bySymbol.symbol;

    // Check by code
    const byCode = CURRENCIES.find(c => c.code.toLowerCase() === inputLower);
    if (byCode) return byCode.symbol;

    // Check by name (English or Arabic)
    const byName = CURRENCIES.find(c =>
        c.name.toLowerCase() === inputLower ||
        c.nameAr === input
    );
    if (byName) return byName.symbol;

    // Check if name contains the input
    const byPartialName = CURRENCIES.find(c =>
        c.name.toLowerCase().includes(inputLower) ||
        inputLower.includes(c.name.toLowerCase())
    );
    if (byPartialName) return byPartialName.symbol;

    // If nothing found, return the input as-is (might be a custom symbol)
    return input;
}

/**
 * Get full currency info from code or name
 * @param {string} input - Currency code, name, or symbol
 * @returns {object|null} - Currency object or null
 */
export function getCurrencyInfo(input) {
    if (!input) return CURRENCIES[0]; // Default to EUR

    const inputLower = input.toLowerCase().trim();

    return CURRENCIES.find(c =>
        c.code.toLowerCase() === inputLower ||
        c.name.toLowerCase() === inputLower ||
        c.nameAr === input ||
        c.symbol === input
    ) || null;
}

/**
 * Format price with currency symbol
 * @param {number} amount - The amount
 * @param {string} currencyInput - Currency code, name, or symbol
 * @param {boolean} symbolAfter - Put symbol after amount (for RTL)
 * @returns {string} - Formatted price
 */
export function formatPrice(amount, currencyInput, symbolAfter = false) {
    const symbol = getCurrencySymbol(currencyInput);
    const formattedAmount = typeof amount === 'number' ? amount.toFixed(2) : amount;

    return symbolAfter
        ? `${formattedAmount} ${symbol}`
        : `${symbol}${formattedAmount}`;
}
