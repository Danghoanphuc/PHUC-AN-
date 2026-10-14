export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_members: {
        Row: {
          active: boolean
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          acquisition_cost: number
          code: string
          created_at: string
          depreciation_method: string
          id: string
          in_service_date: string | null
          is_active: boolean
          monthly_depreciation: number
          name: string
          note: string | null
          useful_life_months: number | null
        }
        Insert: {
          acquisition_cost: number
          code: string
          created_at?: string
          depreciation_method?: string
          id?: string
          in_service_date?: string | null
          is_active?: boolean
          monthly_depreciation: number
          name: string
          note?: string | null
          useful_life_months?: number | null
        }
        Update: {
          acquisition_cost?: number
          code?: string
          created_at?: string
          depreciation_method?: string
          id?: string
          in_service_date?: string | null
          is_active?: boolean
          monthly_depreciation?: number
          name?: string
          note?: string | null
          useful_life_months?: number | null
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          entity_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          entity_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          entity_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cash_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          account_id: string
          amount: number
          counterparty: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          direction: string
          expense_id: string | null
          flow_class: string
          id: string
          idempotency_key: string | null
          kind: string
          note: string | null
          receivable_id: string | null
          reverses_id: string | null
          route_id: string | null
          sale_id: string | null
          source_ref: string | null
          supplier_payable_id: string | null
          transfer_group: string | null
          txn_date: string
        }
        Insert: {
          account_id: string
          amount: number
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          direction: string
          expense_id?: string | null
          flow_class: string
          id?: string
          idempotency_key?: string | null
          kind: string
          note?: string | null
          receivable_id?: string | null
          reverses_id?: string | null
          route_id?: string | null
          sale_id?: string | null
          source_ref?: string | null
          supplier_payable_id?: string | null
          transfer_group?: string | null
          txn_date?: string
        }
        Update: {
          account_id?: string
          amount?: number
          counterparty?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          direction?: string
          expense_id?: string | null
          flow_class?: string
          id?: string
          idempotency_key?: string | null
          kind?: string
          note?: string | null
          receivable_id?: string | null
          reverses_id?: string | null
          route_id?: string | null
          sale_id?: string | null
          source_ref?: string | null
          supplier_payable_id?: string | null
          transfer_group?: string | null
          txn_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "cash_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_cash_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "cash_movements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: true
            referencedRelation: "cash_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sale_item_margin"
            referencedColumns: ["sale_id"]
          },
          {
            foreignKeyName: "cash_movements_supplier_payable_id_fkey"
            columns: ["supplier_payable_id"]
            isOneToOne: false
            referencedRelation: "supplier_payables"
            referencedColumns: ["id"]
          },
        ]
      }
      compensation_policy_drafts: {
        Row: {
          created_at: string
          details: Json
          effective_from: string | null
          id: string
          policy_code: string
          proposed_on: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          details: Json
          effective_from?: string | null
          id?: string
          policy_code: string
          proposed_on: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          details?: Json
          effective_from?: string | null
          id?: string
          policy_code?: string
          proposed_on?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      customer_activities: {
        Row: {
          body: string
          created_by: string
          customer_id: string
          id: string
          kind: string
          occurred_at: string
        }
        Insert: {
          body: string
          created_by?: string
          customer_id: string
          id?: string
          kind: string
          occurred_at?: string
        }
        Update: {
          body?: string
          created_by?: string
          customer_id?: string
          id?: string
          kind?: string
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_order_items: {
        Row: {
          delivered_pieces: number
          id: string
          order_id: string
          order_qty: number
          order_unit: string
          pieces_per_order_unit: number
          pieces_per_price_unit: number | null
          pieces_qty: number | null
          price_unit: string | null
          product_id: string | null
          request_id: string
          requested_name: string
          unit_price_snapshot: number | null
        }
        Insert: {
          delivered_pieces?: number
          id?: string
          order_id: string
          order_qty: number
          order_unit?: string
          pieces_per_order_unit?: number
          pieces_per_price_unit?: number | null
          pieces_qty?: number | null
          price_unit?: string | null
          product_id?: string | null
          request_id: string
          requested_name: string
          unit_price_snapshot?: number | null
        }
        Update: {
          delivered_pieces?: number
          id?: string
          order_id?: string
          order_qty?: number
          order_unit?: string
          pieces_per_order_unit?: number
          pieces_per_price_unit?: number | null
          pieces_qty?: number | null
          price_unit?: string | null
          product_id?: string | null
          request_id?: string
          requested_name?: string
          unit_price_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_order_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "customer_order_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_order_requests: {
        Row: {
          id: string
          order_id: string
          order_qty: number
          original_request: Json
          requested_name: string
        }
        Insert: {
          id?: string
          order_id: string
          order_qty: number
          original_request: Json
          requested_name: string
        }
        Update: {
          id?: string
          order_id?: string
          order_qty?: number
          original_request?: Json
          requested_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_order_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_orders: {
        Row: {
          cancel_reason: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivery_address_snapshot: string | null
          delivery_date: string
          discount_pct: number
          id: string
          note: string | null
          route_id: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          cancel_reason?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          delivery_address_snapshot?: string | null
          delivery_date: string
          discount_pct: number
          id?: string
          note?: string | null
          route_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          cancel_reason?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          delivery_address_snapshot?: string | null
          delivery_date?: string
          discount_pct?: number
          id?: string
          note?: string | null
          route_id?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tasks: {
        Row: {
          assigned_to: string
          created_by: string
          customer_id: string
          due_at: string
          id: string
          status: string
          title: string
        }
        Insert: {
          assigned_to: string
          created_by?: string
          customer_id: string
          due_at: string
          id?: string
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string
          created_by?: string
          customer_id?: string
          due_at?: string
          id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          assigned_to: string | null
          code: string | null
          created_at: string
          credit_limit: number | null
          credit_policy: string
          customer_type: string | null
          default_discount_pct: number
          id: string
          is_active: boolean
          name: string
          note: string | null
          payment_terms_days: number
          phone: string | null
          route_id: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          code?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_policy?: string
          customer_type?: string | null
          default_discount_pct?: number
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          payment_terms_days?: number
          phone?: string | null
          route_id?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          code?: string | null
          created_at?: string
          credit_limit?: number | null
          credit_policy?: string
          customer_type?: string | null
          default_discount_pct?: number
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          payment_terms_days?: number
          phone?: string | null
          route_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customers_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      data_review_issues: {
        Row: {
          created_at: string
          details: Json
          entity_ref: string
          id: string
          kind: string
          status: string
        }
        Insert: {
          created_at?: string
          details: Json
          entity_ref: string
          id?: string
          kind: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: Json
          entity_ref?: string
          id?: string
          kind?: string
          status?: string
        }
        Relationships: []
      }
      employee_attendance: {
        Row: {
          created_at: string
          day_fraction: number | null
          early_leave_minutes: number
          employee_id: string
          end_time: string | null
          id: string
          makeup_minutes: number
          note: string | null
          start_time: string | null
          status: string
          work_date: string
        }
        Insert: {
          created_at?: string
          day_fraction?: number | null
          early_leave_minutes?: number
          employee_id: string
          end_time?: string | null
          id?: string
          makeup_minutes?: number
          note?: string | null
          start_time?: string | null
          status: string
          work_date: string
        }
        Update: {
          created_at?: string
          day_fraction?: number | null
          early_leave_minutes?: number
          employee_id?: string
          end_time?: string | null
          id?: string
          makeup_minutes?: number
          note?: string | null
          start_time?: string | null
          status?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_compensation_terms: {
        Row: {
          costing_days_per_month: number
          created_at: string
          default_overtime_hours_per_day: number
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          meal_cost_per_day: number
          monthly_allowance: number
          monthly_attendance_bonus: number
          monthly_salary: number
          note: string | null
          overtime_rate_per_hour: number
        }
        Insert: {
          costing_days_per_month?: number
          created_at?: string
          default_overtime_hours_per_day?: number
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          meal_cost_per_day?: number
          monthly_allowance?: number
          monthly_attendance_bonus?: number
          monthly_salary?: number
          note?: string | null
          overtime_rate_per_hour?: number
        }
        Update: {
          costing_days_per_month?: number
          created_at?: string
          default_overtime_hours_per_day?: number
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          meal_cost_per_day?: number
          monthly_allowance?: number
          monthly_attendance_bonus?: number
          monthly_salary?: number
          note?: string | null
          overtime_rate_per_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_compensation_terms_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          role_group: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          role_group: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          role_group?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_date: string
          id: string
          is_fixed: boolean
          note: string | null
          route_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          expense_date: string
          id?: string
          is_fixed?: boolean
          note?: string | null
          route_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          id?: string
          is_fixed?: boolean
          note?: string | null
          route_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_costs: {
        Row: {
          baseline_flour_kg_max: number | null
          baseline_flour_kg_min: number | null
          category: string
          code: string
          cost_type: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          monthly_amount_max: number | null
          monthly_amount_min: number | null
          monthly_amount_standard: number
          name: string
          note: string | null
          step_flour_kg: number | null
          step_monthly_amount: number | null
        }
        Insert: {
          baseline_flour_kg_max?: number | null
          baseline_flour_kg_min?: number | null
          category: string
          code: string
          cost_type?: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          monthly_amount_max?: number | null
          monthly_amount_min?: number | null
          monthly_amount_standard?: number
          name: string
          note?: string | null
          step_flour_kg?: number | null
          step_monthly_amount?: number | null
        }
        Update: {
          baseline_flour_kg_max?: number | null
          baseline_flour_kg_min?: number | null
          category?: string
          code?: string
          cost_type?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          monthly_amount_max?: number | null
          monthly_amount_min?: number | null
          monthly_amount_standard?: number
          name?: string
          note?: string | null
          step_flour_kg?: number | null
          step_monthly_amount?: number | null
        }
        Relationships: []
      }
      goods_receipt_items: {
        Row: {
          amount: number
          base_qty: number
          id: string
          purchase_order_item_id: string
          quantity: number
          receipt_id: string
        }
        Insert: {
          amount: number
          base_qty: number
          id?: string
          purchase_order_item_id: string
          quantity: number
          receipt_id: string
        }
        Update: {
          amount?: number
          base_qty?: number
          id?: string
          purchase_order_item_id?: string
          quantity?: number
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invoice_no: string | null
          purchase_order_id: string
          received_date: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invoice_no?: string | null
          purchase_order_id: string
          received_date: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_no?: string | null
          purchase_order_id?: string
          received_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_snapshots: {
        Row: {
          closing_qty: number
          created_at: string
          id: string
          in_qty: number
          material_id: string
          opening_qty: number
          out_qty: number
          snapshot_date: string
          source_ref: string | null
          source_system: string
        }
        Insert: {
          closing_qty?: number
          created_at?: string
          id?: string
          in_qty?: number
          material_id: string
          opening_qty?: number
          out_qty?: number
          snapshot_date: string
          source_ref?: string | null
          source_system?: string
        }
        Update: {
          closing_qty?: number
          created_at?: string
          id?: string
          in_qty?: number
          material_id?: string
          opening_qty?: number
          out_qty?: number
          snapshot_date?: string
          source_ref?: string | null
          source_system?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_snapshots_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_material_stock"
            referencedColumns: ["material_id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          counterparty: string | null
          created_at: string
          id: string
          included_in_snapshot_id: string | null
          material_id: string
          qty: number
          receipt_item_id: string | null
          source_ref: string | null
          source_system: string
          txn_date: string
          txn_no: string | null
          txn_type: string
          unit_cost: number | null
        }
        Insert: {
          counterparty?: string | null
          created_at?: string
          id?: string
          included_in_snapshot_id?: string | null
          material_id: string
          qty: number
          receipt_item_id?: string | null
          source_ref?: string | null
          source_system?: string
          txn_date: string
          txn_no?: string | null
          txn_type: string
          unit_cost?: number | null
        }
        Update: {
          counterparty?: string | null
          created_at?: string
          id?: string
          included_in_snapshot_id?: string | null
          material_id?: string
          qty?: number
          receipt_item_id?: string | null
          source_ref?: string | null
          source_system?: string
          txn_date?: string
          txn_no?: string | null
          txn_type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_included_in_snapshot_id_fkey"
            columns: ["included_in_snapshot_id"]
            isOneToOne: false
            referencedRelation: "inventory_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_material_stock"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "inventory_transactions_receipt_item_id_fkey"
            columns: ["receipt_item_id"]
            isOneToOne: true
            referencedRelation: "goods_receipt_items"
            referencedColumns: ["id"]
          },
        ]
      }
      material_prices: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          material_id: string
          note: string | null
          package_price: number
          package_qty: number
          package_unit: string
          supplier_id: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          effective_date: string
          id?: string
          material_id: string
          note?: string | null
          package_price: number
          package_qty: number
          package_unit: string
          supplier_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          material_id?: string
          note?: string | null
          package_price?: number
          package_qty?: number
          package_unit?: string
          supplier_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_material_stock"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_stock_baselines: {
        Row: {
          ledger_cutoff: string
          material_id: string
          opening_qty: number
          recorded_by: string | null
          snapshot_id: string | null
          verified: boolean
        }
        Insert: {
          ledger_cutoff: string
          material_id: string
          opening_qty: number
          recorded_by?: string | null
          snapshot_id?: string | null
          verified?: boolean
        }
        Update: {
          ledger_cutoff?: string
          material_id?: string
          opening_qty?: number
          recorded_by?: string | null
          snapshot_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "material_stock_baselines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_stock_baselines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "v_material_stock"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_stock_baselines_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "material_stock_baselines_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "inventory_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          base_unit: string
          category: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          min_stock_qty: number
          name: string
        }
        Insert: {
          base_unit: string
          category?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_stock_qty?: number
          name: string
        }
        Update: {
          base_unit?: string
          category?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_stock_qty?: number
          name?: string
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          contact_phone: string | null
          email: string | null
          full_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_phone?: string | null
          email?: string | null
          full_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_phone?: string | null
          email?: string | null
          full_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_product_name_rules: {
        Row: {
          alias: string
          canonical_name: string
          confirmed_on: string
          customer_id: string | null
          member_skus: string[]
          note: string | null
          order_unit: string
          pieces_per_order_unit: number
          product_id: string | null
          scope: string
        }
        Insert: {
          alias: string
          canonical_name: string
          confirmed_on: string
          customer_id?: string | null
          member_skus?: string[]
          note?: string | null
          order_unit?: string
          pieces_per_order_unit?: number
          product_id?: string | null
          scope?: string
        }
        Update: {
          alias?: string
          canonical_name?: string
          confirmed_on?: string
          customer_id?: string | null
          member_skus?: string[]
          note?: string | null
          order_unit?: string
          pieces_per_order_unit?: number
          product_id?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_product_name_rules_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_product_name_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_aliases: {
        Row: {
          alias_sku: string
          created_at: string
          note: string | null
          product_id: string
          source_system: string
        }
        Insert: {
          alias_sku: string
          created_at?: string
          note?: string | null
          product_id: string
          source_system?: string
        }
        Update: {
          alias_sku?: string
          created_at?: string
          note?: string | null
          product_id?: string
          source_system?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          pieces_per_order_unit: number
          pieces_per_price_unit: number
          price_unit: string
          product_id: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          pieces_per_order_unit?: number
          pieces_per_price_unit: number
          price_unit: string
          product_id: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          pieces_per_order_unit?: number
          pieces_per_price_unit?: number
          price_unit?: string
          product_id?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_daily: {
        Row: {
          contribution_before_route_estimate: number | null
          created_at: string
          direct_labor_cost_estimate: number | null
          estimate_status: string
          fixed_overhead_cost_estimate: number | null
          gross_profit_estimate: number | null
          id: string
          management_cost_estimate: number | null
          note: string | null
          production_date: string
        }
        Insert: {
          contribution_before_route_estimate?: number | null
          created_at?: string
          direct_labor_cost_estimate?: number | null
          estimate_status?: string
          fixed_overhead_cost_estimate?: number | null
          gross_profit_estimate?: number | null
          id?: string
          management_cost_estimate?: number | null
          note?: string | null
          production_date: string
        }
        Update: {
          contribution_before_route_estimate?: number | null
          created_at?: string
          direct_labor_cost_estimate?: number | null
          estimate_status?: string
          fixed_overhead_cost_estimate?: number | null
          gross_profit_estimate?: number | null
          id?: string
          management_cost_estimate?: number | null
          note?: string | null
          production_date?: string
        }
        Relationships: []
      }
      production_daily_items: {
        Row: {
          created_at: string
          estimated_gross_profit: number | null
          estimated_output_qty: number | null
          estimated_output_unit: string | null
          id: string
          is_estimate: boolean
          item_label: string
          note: string | null
          product_id: string | null
          production_daily_id: string
          reported_qty: number | null
          reported_unit: string | null
        }
        Insert: {
          created_at?: string
          estimated_gross_profit?: number | null
          estimated_output_qty?: number | null
          estimated_output_unit?: string | null
          id?: string
          is_estimate?: boolean
          item_label: string
          note?: string | null
          product_id?: string | null
          production_daily_id: string
          reported_qty?: number | null
          reported_unit?: string | null
        }
        Update: {
          created_at?: string
          estimated_gross_profit?: number | null
          estimated_output_qty?: number | null
          estimated_output_unit?: string | null
          id?: string
          is_estimate?: boolean
          item_label?: string
          note?: string | null
          product_id?: string | null
          production_daily_id?: string
          reported_qty?: number | null
          reported_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_daily_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_daily_items_production_daily_id_fkey"
            columns: ["production_daily_id"]
            isOneToOne: false
            referencedRelation: "production_daily"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          list_price: number | null
          name: string
          pack_qty: number
          sale_unit: string
          sku: string
          wholesale_price: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          list_price?: number | null
          name: string
          pack_qty?: number
          sale_unit?: string
          sku: string
          wholesale_price?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          list_price?: number | null
          name?: string
          pack_qty?: number
          sale_unit?: string
          sku?: string
          wholesale_price?: number | null
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          base_qty_per_unit: number
          id: string
          material_id: string
          purchase_order_id: string
          purchase_unit: string
          quantity: number
          received_qty: number
          unit_price: number
        }
        Insert: {
          base_qty_per_unit: number
          id?: string
          material_id: string
          purchase_order_id: string
          purchase_unit: string
          quantity: number
          received_qty?: number
          unit_price: number
        }
        Update: {
          base_qty_per_unit?: number
          id?: string
          material_id?: string
          purchase_order_id?: string
          purchase_unit?: string
          quantity?: number
          received_qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_material_stock"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_by: string | null
          cancel_reason: string | null
          created_at: string
          created_by: string
          expected_date: string
          id: string
          note: string | null
          status: string
          supplier_id: string
          version: number
        }
        Insert: {
          approved_by?: string | null
          cancel_reason?: string | null
          created_at?: string
          created_by: string
          expected_date: string
          id?: string
          note?: string | null
          status?: string
          supplier_id: string
          version?: number
        }
        Update: {
          approved_by?: string | null
          cancel_reason?: string | null
          created_at?: string
          created_by?: string
          expected_date?: string
          id?: string
          note?: string | null
          status?: string
          supplier_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          due_date: string | null
          id: string
          paid_amount: number
          sale_id: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          paid_amount?: number
          sale_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          id?: string
          paid_amount?: number
          sale_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sale_item_margin"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          id: string
          material_id: string
          note: string | null
          qty: number
          recipe_id: string
          unit: string
          wastage_pct: number
        }
        Insert: {
          id?: string
          material_id: string
          note?: string | null
          qty: number
          recipe_id: string
          unit: string
          wastage_pct?: number
        }
        Update: {
          id?: string
          material_id?: string
          note?: string | null
          qty?: number
          recipe_id?: string
          unit?: string
          wastage_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_material_stock"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "v_recipe_cost"
            referencedColumns: ["recipe_id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          is_active: boolean
          note: string | null
          product_id: string
          version_no: number
          yield_qty: number
          yield_unit: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          id?: string
          is_active?: boolean
          note?: string | null
          product_id: string
          version_no?: number
          yield_qty: number
          yield_unit: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          is_active?: boolean
          note?: string | null
          product_id?: string
          version_no?: number
          yield_qty?: number
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          idempotency_key: string | null
          product_id: string
          qty: number
          reason: string | null
          refund_amount: number
          return_date: string
          return_phase: string
          route_id: string | null
          sale_id: string | null
          sale_item_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          idempotency_key?: string | null
          product_id: string
          qty: number
          reason?: string | null
          refund_amount?: number
          return_date: string
          return_phase?: string
          route_id?: string | null
          sale_id?: string | null
          sale_item_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          idempotency_key?: string | null
          product_id?: string
          qty?: number
          reason?: string | null
          refund_amount?: number
          return_date?: string
          return_phase?: string
          route_id?: string | null
          sale_id?: string | null
          sale_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sale_item_margin"
            referencedColumns: ["sale_id"]
          },
          {
            foreignKeyName: "returns_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "v_sale_item_margin"
            referencedColumns: ["sale_item_id"]
          },
        ]
      }
      route_assignments: {
        Row: {
          route_id: string
          user_id: string
        }
        Insert: {
          route_id: string
          user_id: string
        }
        Update: {
          route_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_assignments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      routes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          logistics_cost_per_day: number
          name: string
          note: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          logistics_cost_per_day?: number
          name: string
          note?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          logistics_cost_per_day?: number
          name?: string
          note?: string | null
        }
        Relationships: []
      }
      sale_item_costs: {
        Row: {
          cost_complete: boolean
          sale_item_id: string
          unit_material_cost_snapshot: number | null
        }
        Insert: {
          cost_complete: boolean
          sale_item_id: string
          unit_material_cost_snapshot?: number | null
        }
        Update: {
          cost_complete?: boolean
          sale_item_id?: string
          unit_material_cost_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_item_costs_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: true
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_costs_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: true
            referencedRelation: "v_sale_item_margin"
            referencedColumns: ["sale_item_id"]
          },
        ]
      }
      sale_items: {
        Row: {
          discount_pct: number
          id: string
          line_amount: number | null
          order_item_id: string | null
          pieces_per_price_unit_snapshot: number | null
          price_unit_snapshot: string | null
          product_id: string
          qty: number
          qty_delivered: number
          qty_returned: number
          sale_id: string
          unit_price: number
          unit_price_locked: boolean
        }
        Insert: {
          discount_pct?: number
          id?: string
          line_amount?: number | null
          order_item_id?: string | null
          pieces_per_price_unit_snapshot?: number | null
          price_unit_snapshot?: string | null
          product_id: string
          qty: number
          qty_delivered?: number
          qty_returned?: number
          sale_id: string
          unit_price: number
          unit_price_locked?: boolean
        }
        Update: {
          discount_pct?: number
          id?: string
          line_amount?: number | null
          order_item_id?: string | null
          pieces_per_price_unit_snapshot?: number | null
          price_unit_snapshot?: string | null
          product_id?: string
          qty?: number
          qty_delivered?: number
          qty_returned?: number
          sale_id?: string
          unit_price?: number
          unit_price_locked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "customer_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sale_item_margin"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sales: {
        Row: {
          collected_amount: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_order_id: string | null
          discount_amount: number
          gross_amount: number
          id: string
          idempotency_key: string | null
          invoice_no: string | null
          net_amount: number | null
          note: string | null
          payment_status: string
          route_id: string | null
          sale_date: string
          version: number
        }
        Insert: {
          collected_amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_order_id?: string | null
          discount_amount?: number
          gross_amount?: number
          id?: string
          idempotency_key?: string | null
          invoice_no?: string | null
          net_amount?: number | null
          note?: string | null
          payment_status?: string
          route_id?: string | null
          sale_date: string
          version?: number
        }
        Update: {
          collected_amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_order_id?: string | null
          discount_amount?: number
          gross_amount?: number
          id?: string
          idempotency_key?: string | null
          invoice_no?: string | null
          net_amount?: number | null
          note?: string | null
          payment_status?: string
          route_id?: string | null
          sale_date?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      selling_prices: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          effective_from: string
          effective_to: string | null
          id: string
          pieces_per_price_unit: number
          price_tier: string
          price_unit: string
          product_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          pieces_per_price_unit: number
          price_tier: string
          price_unit: string
          product_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          pieces_per_price_unit?: number
          price_tier?: string
          price_unit?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "selling_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "selling_prices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selling_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payables: {
        Row: {
          amount: number
          due_date: string
          id: string
          paid_amount: number
          receipt_id: string
          supplier_id: string
        }
        Insert: {
          amount: number
          due_date: string
          id?: string
          paid_amount?: number
          receipt_id: string
          supplier_id: string
        }
        Update: {
          amount?: number
          due_date?: string
          id?: string
          paid_amount?: number
          receipt_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payables_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: true
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payables_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phone?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          completed_at: string | null
          id: string
          note: string | null
          source_ref: string | null
          source_system: string
          started_at: string
          stats: Json
          status: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          note?: string | null
          source_ref?: string | null
          source_system: string
          started_at?: string
          stats?: Json
          status?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          note?: string | null
          source_ref?: string | null
          source_system?: string
          started_at?: string
          stats?: Json
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_cash_balances: {
        Row: {
          account_id: string | null
          account_type: string | null
          balance: number | null
          code: string | null
          name: string | null
        }
        Relationships: []
      }
      v_cash_daily: {
        Row: {
          balance_change: number | null
          external_net: number | null
          financing_in: number | null
          financing_out: number | null
          investing_in: number | null
          investing_out: number | null
          operating_in: number | null
          operating_out: number | null
          txn_date: string | null
        }
        Relationships: []
      }
      v_current_labor_costs: {
        Row: {
          estimated_daily_cost: number | null
          estimated_monthly_cost: number | null
          role_group: string | null
        }
        Relationships: []
      }
      v_daily_route_profit: {
        Row: {
          day: string | null
          estimated_material_cost: number | null
          estimated_route_contribution: number | null
          net_sales: number | null
          returns_affecting_revenue: number | null
          returns_amount: number | null
          route_expenses: number | null
          route_id: string | null
          route_name: string | null
        }
        Relationships: []
      }
      v_inventory_latest: {
        Row: {
          base_unit: string | null
          is_low: boolean | null
          material_code: string | null
          material_id: string | null
          material_name: string | null
          min_stock_qty: number | null
          qty_on_hand: number | null
          snapshot_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_snapshots_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_material_stock"
            referencedColumns: ["material_id"]
          },
        ]
      }
      v_latest_material_cost: {
        Row: {
          effective_date: string | null
          material_code: string | null
          material_id: string | null
          material_name: string | null
          package_unit: string | null
          unit_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "v_material_stock"
            referencedColumns: ["material_id"]
          },
        ]
      }
      v_material_stock: {
        Row: {
          base_unit: string | null
          baseline_date: string | null
          baseline_qty: number | null
          code: string | null
          is_reconciled: boolean | null
          legacy_unreconciled_count: number | null
          material_id: string | null
          mobile_delta: number | null
          name: string | null
          qty_on_hand: number | null
        }
        Relationships: []
      }
      v_monthly_overhead_summary: {
        Row: {
          depreciation_costs: number | null
          fixed_operating_costs: number | null
          total_monthly_overhead: number | null
        }
        Relationships: []
      }
      v_recipe_cost: {
        Row: {
          batch_material_cost: number | null
          effective_date: string | null
          material_cost_per_yield_unit: number | null
          product_id: string | null
          product_name: string | null
          recipe_id: string | null
          sku: string | null
          version_no: number | null
          yield_qty: number | null
          yield_unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sale_item_margin: {
        Row: {
          customer_id: string | null
          discount_pct: number | null
          estimated_contribution_before_returns_and_route_cost: number | null
          estimated_material_cost: number | null
          estimated_unit_material_cost: number | null
          line_amount: number | null
          product_id: string | null
          product_name: string | null
          qty: number | null
          route_id: string | null
          sale_date: string | null
          sale_id: string | null
          sale_item_id: string | null
          sku: string | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bind_order_alias: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      collect_receivable: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      create_sale_order: { Args: { payload: Json }; Returns: string }
      invite_member: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      list_member_invites: { Args: never; Returns: Json }
      manage_member: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      pay_supplier: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      phone_setup_target: {
        Args: { phone: string; token_hash: string }
        Returns: string
      }
      post_delivery: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      provision_phone_member: { Args: { payload: Json }; Returns: undefined }
      receive_purchase_order: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      reconcile_material_stock: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      resolve_order_alias: {
        Args: { alias: string; customer_id: string }
        Returns: Json
      }
      return_sale_item: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      reverse_cash_movement: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      save_customer_order: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      save_purchase_order: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      set_selling_price: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      transition_customer_order: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
      transition_purchase_order: {
        Args: { payload: Json; request_key: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

