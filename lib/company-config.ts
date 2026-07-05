const activeBranch = process.env.NEXT_PUBLIC_ACTIVE_BRANCH;

const baseCompanyInfo = {
    name: 'CAHAYA CARGO EXPRESS',
    address: 'Jalan Kemudi No 4',
    city: 'Surabaya',
    phone: '081 337 878 138',
    branchAddress: 'Jl Irian No. 245 B',
    branchCity: 'Makassar',
    branchPhone: '0852 4228 0396',
    branch2Address: 'Jl. Gelandakan (Ps Sentra Bilanja Hancap) G1',
    branch2City: 'Banjarmasin',
    branch2Phone: '081 2954 777',
    branch3Address: 'Jl. Gandasari (PS Sentra Bisnis Warlob) G 1',
    branch3City: 'Bandung',
    branch3Phone: '081 337 878 138',
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

// Override primary info if in branch-specific deployment
if (activeBranch === 'makassar') {
    baseCompanyInfo.address = baseCompanyInfo.branchAddress;
    baseCompanyInfo.city = baseCompanyInfo.branchCity;
    baseCompanyInfo.phone = baseCompanyInfo.branchPhone;
    baseCompanyInfo.name = 'CAHAYA CARGO EXPRESS (MAKASSAR)';
} else if (activeBranch === 'bandung') {
    baseCompanyInfo.address = baseCompanyInfo.branch3Address;
    baseCompanyInfo.city = baseCompanyInfo.branch3City;
    baseCompanyInfo.phone = baseCompanyInfo.branch3Phone;
    baseCompanyInfo.name = 'CAHAYA CARGO EXPRESS (BANDUNG)';
}

export const COMPANY_INFO = baseCompanyInfo;


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

