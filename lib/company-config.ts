// Company information for invoices and app branding

export const COMPANY_INFO = {
    name: 'CAHAYA CARGO EXPRESS',
    address: 'Jl. Kalimas Baru No. 60',
    city: 'Surabaya',
    phone: '081 337 878 138',
    branchAddress: 'Jl Irian No. 245 B',
    branchCity: 'Makassar',
    branchPhone: '0852 4228 0396',
    branch2Address: 'Jl. Gelandakan (Ps Sentra Bilanja Hancap) G1',
    branch2City: 'Banjarmasin',
    branch2Phone: '081 2954 777',
    email: '',

    // Bank account details for transfer
    bankAccounts: [
        {
            bank: 'BCA',
            accountNumber: '1870444342',
            accountName: 'MARTINI',
        },
        {
            bank: 'BRI',
            accountNumber: '0328 0107 3891 501',
            accountName: 'MARTINI',
        },
        {
            bank: 'MANDIRI',
            accountNumber: '14000 2408 7851',
            accountName: 'MARTINI',
        },
    ],

    // Signature for invoices
    signatureName: 'HILAL BAFAGIH',
    signatureTitle: 'Hormat Kami',
};

/**
 * Get formatted bank transfer information for display
 */
export const getBankTransferInfo = (): string[] => {
    return COMPANY_INFO.bankAccounts.map(
        (account) => `${account.bank} ${account.accountNumber} an ${account.accountName}`
    );
};

/**
 * Get company full address
 */
export const getCompanyAddress = (): string => {
    return `${COMPANY_INFO.address}, ${COMPANY_INFO.city}`;
};

/**
 * Get BCA account specifically (for PPN invoices)
 */
export const getBCAAccount = () => {
    return COMPANY_INFO.bankAccounts.find(acc => acc.bank === 'BCA');
};

