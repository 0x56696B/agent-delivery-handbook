# Vendor meter protocol guide (clipping)

Source: https://example.com/vendor/meter-protocol-guide

## Reading payload
Each meter sends one reading per interval. The `value` field is a decimal string with up to three digits after the point. The `unit` field is always `kWh`.

## Precision
The meter keeps three decimal places. A receiver must not round the value before it stores it. A receiver may round only when it shows the value to a user.

## Retries
The meter resends a reading if it gets no acknowledgement within 30 seconds. A receiver must treat a repeated `reading_id` as a duplicate.
