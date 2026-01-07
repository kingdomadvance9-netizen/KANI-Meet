# M-Pesa Integration Setup Guide

## 1. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your M-Pesa credentials:

```bash
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_SHORTCODE=your_paybill_number_here
MPESA_PASSKEY=your_passkey_here
MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
MPESA_ENVIRONMENT=sandbox
```

## 2. Files Created

### Backend

- `lib/mpesa.ts` - M-Pesa API integration library
- `lib/database/transactions.ts` - Transaction database interface
- `app/api/mpesa/initiate/route.ts` - Initiate STK Push API
- `app/api/mpesa/callback/route.ts` - Handle M-Pesa callbacks

### Frontend

- `components/PaymentModal.tsx` - Payment form modal

## 3. How to Use

### In Any Component:

```tsx
import { useState } from "react";
import PaymentModal from "@/components/PaymentModal";

export default function YourComponent() {
  const [showPayment, setShowPayment] = useState(false);

  return (
    <>
      <button onClick={() => setShowPayment(true)}>Pay with M-Pesa</button>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
      />
    </>
  );
}
```

## 4. Database Setup

The current implementation uses in-memory storage. To connect to a real database:

### Option A: Prisma (Recommended)

1. Install Prisma:

```bash
npm install @prisma/client
npm install -D prisma
```

2. Initialize Prisma:

```bash
npx prisma init
```

3. Add to `schema.prisma`:

```prisma
model Transaction {
  id                  String   @id @default(cuid())
  userId              String
  phoneNumber         String
  amount              Float
  accountType         String
  accountReference    String
  merchantRequestId   String
  checkoutRequestId   String   @unique
  mpesaReceiptNumber  String?
  transactionDate     String?
  status              String   @default("pending")
  resultCode          Int?
  resultDesc          String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

4. Run migration:

```bash
npx prisma migrate dev --name add_transactions
```

5. Update `lib/database/transactions.ts` to use Prisma instead of in-memory storage.

### Option B: MongoDB

Install MongoDB driver:

```bash
npm install mongodb
```

Create `lib/mongodb.ts` and update the transaction functions accordingly.

## 5. Testing

### Sandbox Testing (Before Production)

1. Use test credentials from Safaricom Daraja
2. Test phone numbers: Use actual phone numbers
3. Test amounts: Use small amounts (1-100 KES)

### Production Checklist

- [ ] Change `MPESA_ENVIRONMENT` to `production`
- [ ] Use production credentials
- [ ] Set up a public callback URL (use ngrok for local testing)
- [ ] Implement proper error logging
- [ ] Add transaction retry logic
- [ ] Set up monitoring for callbacks

## 6. Callback URL Setup

For local development, use ngrok:

```bash
ngrok http 3000
```

Then update your `.env.local`:

```
MPESA_CALLBACK_URL=https://your-ngrok-url.ngrok.io/api/mpesa/callback
```

## 7. Security Considerations

- ✅ Always validate user authentication
- ✅ Validate phone numbers and amounts
- ✅ Log all transactions
- ✅ Handle callback retries gracefully
- ✅ Never expose credentials in frontend
- ✅ Use HTTPS in production

## 8. Common Issues

### Payment Not Received

- Check callback URL is publicly accessible
- Verify M-Pesa credentials
- Check phone number format (254...)
- Ensure paybill/till number is correct

### Callback Not Working

- Verify URL is accessible (test with curl)
- Check server logs for errors
- M-Pesa retries failed callbacks several times

### Amount Issues

- Amount must be an integer (whole numbers only)
- Minimum: 1 KES
- Maximum: varies by account type

## 9. Support

For M-Pesa API issues:

- Safaricom Daraja Portal: https://developer.safaricom.co.ke
- Support Email: apisupport@safaricom.co.ke
