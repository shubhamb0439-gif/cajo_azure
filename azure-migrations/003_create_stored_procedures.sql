/*
  ============================================================
  AZURE SQL MIGRATION 003 — Stored Procedures
  ============================================================
  Creates stored procedures that replace Supabase PostgreSQL
  functions and Edge Function business logic.

  Procedures:
  1. sp_execute_assembly_transaction
     — Validates stock, deducts components, creates assembly
       and assembly units in a single transaction.

  2. sp_reverse_assembly
     — Reverses an assembly: restores component stock,
       deletes assembly records.

  3. sp_fulfill_delivery
     — Marks delivery items as fulfilled, reduces finished
       product inventory.

  4. sp_update_po_status
     — Updates purchase order status based on fulfillment
       of all line items.

  5. sp_receive_purchase_items
     — Records receipt of purchase items and updates
       inventory stock.
  ============================================================
*/

-- ─── 1. EXECUTE ASSEMBLY TRANSACTION ─────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_execute_assembly_transaction
    @bom_id       UNIQUEIDENTIFIER,
    @quantity     INT,
    @po_number    NVARCHAR(100) = NULL,
    @created_by   UNIQUEIDENTIFIER = NULL,
    @assembly_id  UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    BEGIN TRY
        DECLARE @bom_finished_product_id UNIQUEIDENTIFIER;
        DECLARE @bom_output_quantity DECIMAL(18,4);

        SELECT
            @bom_finished_product_id = finished_product_id,
            @bom_output_quantity = output_quantity
        FROM boms
        WHERE id = @bom_id;

        IF @bom_finished_product_id IS NULL
        BEGIN
            ROLLBACK;
            RAISERROR('BOM not found.', 16, 1);
            RETURN;
        END

        IF EXISTS (
            SELECT 1 FROM bom_components bc
            JOIN inventory_items i ON i.id = bc.inventory_item_id
            WHERE bc.bom_id = @bom_id
              AND i.quantity_in_stock < (bc.quantity_required * @quantity)
        )
        BEGIN
            ROLLBACK;
            RAISERROR('Insufficient stock for one or more components.', 16, 1);
            RETURN;
        END

        SET @assembly_id = NEWID();
        INSERT INTO assemblies (id, bom_id, quantity, po_number, created_by)
        VALUES (@assembly_id, @bom_id, @quantity, @po_number, @created_by);

        UPDATE i
        SET i.quantity_in_stock = i.quantity_in_stock - (bc.quantity_required * @quantity),
            i.updated_at = SYSUTCDATETIME()
        FROM inventory_items i
        JOIN bom_components bc ON bc.inventory_item_id = i.id
        WHERE bc.bom_id = @bom_id;

        UPDATE inventory_items
        SET quantity_in_stock = quantity_in_stock + (@bom_output_quantity * @quantity),
            updated_at = SYSUTCDATETIME()
        WHERE id = @bom_finished_product_id;

        DECLARE @i INT = 1;
        WHILE @i <= @quantity
        BEGIN
            INSERT INTO assembly_units (assembly_id, unit_cost)
            VALUES (@assembly_id, 0);
            SET @i = @i + 1;
        END

        INSERT INTO assembly_components (assembly_id, inventory_item_id, quantity_used)
        SELECT @assembly_id, bc.inventory_item_id, bc.quantity_required * @quantity
        FROM bom_components bc
        WHERE bc.bom_id = @bom_id;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@msg, 16, 1);
    END CATCH
END;
GO

-- ─── 2. REVERSE ASSEMBLY ─────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_reverse_assembly
    @assembly_id UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    BEGIN TRY
        DECLARE @bom_id UNIQUEIDENTIFIER;
        DECLARE @quantity DECIMAL(18,4);
        SELECT @bom_id = bom_id, @quantity = quantity
        FROM assemblies
        WHERE id = @assembly_id;

        IF @bom_id IS NULL
        BEGIN
            ROLLBACK;
            RAISERROR('Assembly not found.', 16, 1);
            RETURN;
        END

        UPDATE i
        SET i.quantity_in_stock = i.quantity_in_stock + ac.quantity_used,
            i.updated_at = SYSUTCDATETIME()
        FROM inventory_items i
        JOIN assembly_components ac ON ac.inventory_item_id = i.id
        WHERE ac.assembly_id = @assembly_id;

        DECLARE @finished_product_id UNIQUEIDENTIFIER;
        DECLARE @output_quantity DECIMAL(18,4);
        SELECT @finished_product_id = b.finished_product_id,
               @output_quantity = b.output_quantity
        FROM boms b
        WHERE b.id = @bom_id;

        UPDATE inventory_items
        SET quantity_in_stock = quantity_in_stock - (@output_quantity * @quantity),
            updated_at = SYSUTCDATETIME()
        WHERE id = @finished_product_id;

        DELETE FROM assemblies WHERE id = @assembly_id;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@msg, 16, 1);
    END CATCH
END;
GO

-- ─── 3. FULFILL DELIVERY ─────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_fulfill_delivery
    @delivery_id UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM deliveries WHERE id = @delivery_id)
        BEGIN
            ROLLBACK;
            RAISERROR('Delivery not found.', 16, 1);
            RETURN;
        END

        UPDATE i
        SET i.quantity_in_stock = i.quantity_in_stock - di.quantity_delivered,
            i.sales_sold = i.sales_sold + CAST(di.quantity_delivered AS INT),
            i.updated_at = SYSUTCDATETIME()
        FROM inventory_items i
        JOIN sale_items si ON si.inventory_item_id = i.id
        JOIN delivery_items di ON di.sale_item_id = si.id
        WHERE di.delivery_id = @delivery_id;

        UPDATE deliveries
        SET status = 'fulfilled', updated_at = SYSUTCDATETIME()
        WHERE id = @delivery_id;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@msg, 16, 1);
    END CATCH
END;
GO

-- ─── 4. UPDATE PO STATUS ─────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_update_po_status
    @purchase_id UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @total_ordered  DECIMAL(18,4);
    DECLARE @total_received DECIMAL(18,4);

    SELECT
        @total_ordered  = SUM(quantity_ordered),
        @total_received = SUM(quantity_received)
    FROM purchase_items
    WHERE purchase_id = @purchase_id;

    DECLARE @new_status NVARCHAR(50) = 'pending';

    IF @total_received >= @total_ordered
        SET @new_status = 'received';
    ELSE IF @total_received > 0
        SET @new_status = 'partial';

    UPDATE purchases
    SET status = @new_status, updated_at = SYSUTCDATETIME()
    WHERE id = @purchase_id;
END;
GO

-- ─── 5. RECEIVE PURCHASE ITEMS ───────────────────────────────────────────────
CREATE OR ALTER PROCEDURE sp_receive_purchase_items
    @purchase_id  UNIQUEIDENTIFIER,
    @items_json   NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    BEGIN TRY
        DECLARE @items TABLE (
            id                UNIQUEIDENTIFIER,
            quantity_received DECIMAL(18,4)
        );

        INSERT INTO @items (id, quantity_received)
        SELECT
            TRY_CAST(JSON_VALUE(value, '$.id') AS UNIQUEIDENTIFIER),
            TRY_CAST(JSON_VALUE(value, '$.quantity_received') AS DECIMAL(18,4))
        FROM OPENJSON(@items_json);

        UPDATE pi
        SET pi.quantity_received  = pi.quantity_received + t.quantity_received,
            pi.remaining_quantity = pi.remaining_quantity + t.quantity_received
        FROM purchase_items pi
        JOIN @items t ON t.id = pi.id
        WHERE pi.purchase_id = @purchase_id;

        UPDATE i
        SET i.quantity_in_stock = i.quantity_in_stock + t.quantity_received,
            i.updated_at = SYSUTCDATETIME()
        FROM inventory_items i
        JOIN purchase_items pi ON pi.inventory_item_id = i.id
        JOIN @items t ON t.id = pi.id
        WHERE pi.purchase_id = @purchase_id;

        EXEC sp_update_po_status @purchase_id;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@msg, 16, 1);
    END CATCH
END;
GO

PRINT 'Migration 003 completed successfully — stored procedures created.';
GO
