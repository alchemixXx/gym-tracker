---
inclusion: manual
---

# Express Route Handler Skill

When creating or modifying Express route handlers in this project, follow these conventions:

## Patterns
- Use `express.Router()` for all route modules
- Wrap async handlers in try/catch with proper error responses
- Return consistent JSON shape: `{ data: ... }` for success, `{ error: string }` for failures
- Use parameterized queries (never string interpolation) for SQL
- Validate required request body fields early and return 400 if missing

## Error Handling
- 400 for bad input
- 404 for not found
- 500 for unexpected errors (log the full error, return generic message to client)

## Example Structure
```typescript
router.post('/resource', async (req, res) => {
  try {
    const { requiredField } = req.body;
    if (!requiredField) {
      return res.status(400).json({ error: 'requiredField is required' });
    }
    const result = await pool.query('INSERT INTO ... VALUES ($1) RETURNING *', [requiredField]);
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('POST /resource error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```
