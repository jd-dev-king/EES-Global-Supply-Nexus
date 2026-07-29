# Supply-to-Production Data Contract

The Part 1 handoff to Pharma Process Twin uses these fields:

- `supplier_id`
- `purchase_order`
- `material`
- `supplier_lot`
- `received_quantity`
- `unit`
- `quality_release_status`
- `expiration_date`
- `received_at`
- `warehouse_location`
- `landed_cost`

Only material lots with `quality_release_status = Approved` can be allocated to a manufacturing batch in Part 2.
