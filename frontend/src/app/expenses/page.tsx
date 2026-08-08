import type {Metadata} from "next";
import {ExpensePortal} from "@/components/ExpensePortal";

export const metadata: Metadata = {title: "Expenses — Co-Op Protocol"};

export default function ExpensesPage() {
  return <ExpensePortal />;
}
