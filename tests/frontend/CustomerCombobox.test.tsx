import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerCombobox } from "../../client/src/components/CustomerCombobox";
import type { Customer } from "../../shared/schema";

// ─── Mock the API module ──────────────────────────────────────────────────────

vi.mock("../../client/src/lib/api", () => ({
  customersApi: {
    create: vi.fn(),
  },
}));

import { customersApi } from "../../client/src/lib/api";
const mockCustomersApi = vi.mocked(customersApi);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const customers: Customer[] = [
  {
    id: 1,
    name: "Acme Corp",
    email: "acme@example.com",
    phone: "555-1234",
    notes: null,
    tags: null,
    leadSource: null,
    company: "Acme Corp",
    createdAt: new Date("2025-01-01"),
  },
  {
    id: 2,
    name: "Beta LLC",
    email: "beta@example.com",
    phone: "555-5678",
    notes: null,
    tags: null,
    leadSource: null,
    company: "Beta LLC",
    createdAt: new Date("2025-01-01"),
  },
  {
    id: 3,
    name: "Gamma Inc",
    email: null,
    phone: null,
    notes: null,
    tags: null,
    leadSource: null,
    company: null,
    createdAt: new Date("2025-01-01"),
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderCombobox(props: Partial<Parameters<typeof CustomerCombobox>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = vi.fn();
  const result = render(
    <QueryClientProvider client={qc}>
      <CustomerCombobox
        customers={customers}
        value={null}
        onChange={onChange}
        {...props}
      />
    </QueryClientProvider>
  );
  return { ...result, onChange };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CustomerCombobox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  describe("initial render", () => {
    it("shows placeholder when no value selected", () => {
      renderCombobox();
      expect(screen.getByText("Select customer...")).toBeInTheDocument();
    });

    it("shows custom placeholder", () => {
      renderCombobox({ placeholder: "Choose a client" });
      expect(screen.getByText("Choose a client")).toBeInTheDocument();
    });

    it("shows selected customer name when value is set", () => {
      renderCombobox({ value: 1 });
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    it("shows X button when a customer is selected", () => {
      renderCombobox({ value: 1 });
      // X button is rendered as an SVG icon inside the trigger
      const trigger = screen.getByRole("button", { name: /acme corp/i });
      expect(trigger).toBeInTheDocument();
    });

    it("dropdown is not visible initially", () => {
      renderCombobox();
      expect(screen.queryByPlaceholderText("Search customers...")).not.toBeInTheDocument();
    });
  });

  // ── Opening the dropdown ─────────────────────────────────────────────────────

  describe("opening the dropdown", () => {
    it("shows dropdown when trigger is clicked", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));

      expect(screen.getByPlaceholderText("Search customers...")).toBeInTheDocument();
    });

    it("shows all customers in the list", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));

      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("Beta LLC")).toBeInTheDocument();
      expect(screen.getByText("Gamma Inc")).toBeInTheDocument();
    });

    it("shows phone number next to customer with phone", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));

      expect(screen.getByText("555-1234")).toBeInTheDocument();
    });

    it("shows 'Add new customer' option", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));

      expect(screen.getByText("Add new customer")).toBeInTheDocument();
    });
  });

  // ── Search ───────────────────────────────────────────────────────────────────

  describe("search filtering", () => {
    it("filters customers by name", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.type(screen.getByPlaceholderText("Search customers..."), "acme");

      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.queryByText("Beta LLC")).not.toBeInTheDocument();
    });

    it("search is case-insensitive", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.type(screen.getByPlaceholderText("Search customers..."), "BETA");

      expect(screen.getByText("Beta LLC")).toBeInTheDocument();
    });

    it("shows 'No customers found' when search has no results", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.type(screen.getByPlaceholderText("Search customers..."), "zzzzz");

      expect(screen.getByText("No customers found")).toBeInTheDocument();
    });

    it("shows 'Add \"search\"' button when search is active", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.type(screen.getByPlaceholderText("Search customers..."), "New Client");

      expect(screen.getByText('Add "New Client"')).toBeInTheDocument();
    });
  });

  // ── Selection ────────────────────────────────────────────────────────────────

  describe("selecting a customer", () => {
    it("calls onChange with customer id when clicked", async () => {
      const user = userEvent.setup();
      const { onChange } = renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.click(screen.getByText("Acme Corp"));

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it("closes dropdown after selection", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.click(screen.getByText("Acme Corp"));

      expect(screen.queryByPlaceholderText("Search customers...")).not.toBeInTheDocument();
    });

    it("calls onChange with null when X is clicked to clear selection", async () => {
      const user = userEvent.setup();
      const { onChange } = renderCombobox({ value: 1 });

      // Find and click the X icon (inside the trigger button)
      const svgIcons = document.querySelectorAll("svg");
      // The X icon is the first one in the trigger
      const xIcon = svgIcons[0];
      await user.click(xIcon);

      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  // ── Quick-add dialog ─────────────────────────────────────────────────────────

  describe("quick-add new customer", () => {
    it("opens quick-add dialog when 'Add new customer' is clicked", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.click(screen.getByText("Add new customer"));

      expect(screen.getByText("New Customer")).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    it("pre-fills name from search when opening dialog via search", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.type(screen.getByPlaceholderText("Search customers..."), "New Client");
      await user.click(screen.getByText('Add "New Client"'));

      const nameInput = screen.getByDisplayValue("New Client");
      expect(nameInput).toBeInTheDocument();
    });

    it("Add Customer button is disabled when name is empty", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.click(screen.getByText("Add new customer"));

      const addBtn = screen.getByRole("button", { name: "Add Customer" });
      expect(addBtn).toBeDisabled();
    });

    it("calls customersApi.create on submit", async () => {
      const user = userEvent.setup();
      const newCustomer: Customer = {
        id: 99,
        name: "New Client",
        email: null,
        phone: "555-9999",
        notes: null,
        tags: null,
        leadSource: null,
        company: null,
        createdAt: new Date(),
      };
      mockCustomersApi.create.mockResolvedValue(newCustomer);

      const { onChange } = renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.click(screen.getByText("Add new customer"));

      const nameInput = screen.getByLabelText(/name \*/i);
      await user.type(nameInput, "New Client");

      const phoneInput = screen.getByPlaceholderText("(555) 000-0000");
      await user.type(phoneInput, "555-9999");

      await user.click(screen.getByRole("button", { name: "Add Customer" }));

      await waitFor(() => {
        expect(mockCustomersApi.create).toHaveBeenCalledWith({
          name: "New Client",
          phone: "555-9999",
          email: undefined,
        });
      });
    });

    it("closes dialog when Cancel is clicked", async () => {
      const user = userEvent.setup();
      renderCombobox();

      await user.click(screen.getByRole("button", { name: /select customer/i }));
      await user.click(screen.getByText("Add new customer"));

      expect(screen.getByText("New Customer")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(screen.queryByText("New Customer")).not.toBeInTheDocument();
      });
    });
  });

  // ── Empty state ──────────────────────────────────────────────────────────────

  describe("with empty customers list", () => {
    it("shows 'No customers found' in dropdown", async () => {
      const user = userEvent.setup();
      renderCombobox({ customers: [] });

      await user.click(screen.getByRole("button", { name: /select customer/i }));

      expect(screen.getByText("No customers found")).toBeInTheDocument();
    });
  });
});
