# Development Scripts

⚠️ **WARNING: These scripts are for DEVELOPMENT/TESTING ONLY!**

## Reset Counters

Reset STT and Invoice counters to default values:

```bash
npx tsx scripts/reset-counters.ts
```

This will reset:
- **STT Counter** → next will be `STT017642`
- **Invoice Counter (Regular)** → next will be `INV012366`
- **Invoice Counter (PKP)** → next will be `INV-PKP05177`

### Also Delete All Transactions (Optional)

To reset counters AND delete all transactions:

```bash
npx tsx scripts/reset-counters.ts --delete-all-transactions
```

⚠️ **USE WITH EXTREME CAUTION!** This will permanently delete ALL transactions from Firestore!

---

## Notes

- Counters are stored in Firestore: `metadata/stt_counter` and `metadata/invoice_counters`
- Deleting counter documents will cause generators to restart from default values
- This is safe for testing but should NEVER be used in production
- Existing transactions are NOT affected unless you use `--delete-all-transactions` flag
