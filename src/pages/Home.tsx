/**
 * Expense Management Automation Platform
 *
 * Complete UI with:
 * - Employee Dashboard (default route)
 * - Manager Review Queue
 * - Audit Log
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Upload,
  FileText,
  DollarSign,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  TrendingUp,
  Shield,
  Users,
  Filter,
  Download,
  ZoomIn,
  Home as HomeIcon,
  ClipboardCheck,
  FileCheck,
  Loader2,
  AlertTriangle,
  ChevronLeft
} from 'lucide-react'
import { callAIAgent } from '@/utils/aiAgent'
import type { NormalizedAgentResponse } from '@/utils/aiAgent'
import { cn } from '@/lib/utils'

// ============================================================================
// TYPE DEFINITIONS - Based on ACTUAL test responses
// ============================================================================

// Receipt Extraction Agent Response
interface ReceiptData {
  vendor_name: string
  transaction_date: string
  transaction_time: string | null
  location: string
  total_amount: number
  currency: string
  tax_amount: number | null
  line_items: Array<{
    item_name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
  payment_method: string | null
  receipt_number: string | null
  extraction_confidence: number
  missing_fields: string[]
}

// Fraud Detection Response
interface FraudAnalysis {
  fraud_risk_level: 'low' | 'medium' | 'high'
  fraud_score: number
  flags: Array<{
    category: string
    severity: 'low' | 'medium' | 'high'
    description: string
    evidence: string
  }>
  duplicate_detected: boolean
  vendor_verified: boolean
  location_plausible: boolean
  recommendation: 'approve' | 'reject' | 'review'
  reasoning: string
}

// Policy Compliance Response
interface PolicyCompliance {
  compliant: boolean
  violations: Array<{
    policy_rule: string
    violation_type: string
    severity: 'low' | 'medium' | 'critical'
    description: string
    policy_reference: string
  }>
  category_limit: {
    limit: number
    actual: number
    within_limit: boolean
  }
  required_approvals: string[]
  missing_documents: string[]
  recommendation: 'approve' | 'reject'
  reasoning: string
}

// Employee Eligibility Response
interface EmployeeEligibility {
  eligible: boolean
  ineligibility_reasons: string[]
  employee_context: {
    department: string
    location: string
    travel_status: string
    meal_plan_enrolled: boolean
    per_diem_active: boolean
    job_level: string
  }
  recommendation: 'approve' | 'reject'
  reasoning: string
}

// Expense Validation Coordinator Response
interface ValidationResult {
  validation_summary: {
    overall_status: string
    confidence_score: number
    risk_level: 'low' | 'medium' | 'high' | 'critical'
  }
  receipt_data: {
    vendor: string
    amount: number
    date: string
    extracted_successfully: boolean
  }
  fraud_analysis: {
    fraud_detected: boolean
    fraud_score: number
    flags_count: number
  }
  policy_compliance: {
    compliant: boolean
    violations_count: number
    critical_violations: boolean
  }
  employee_eligibility: {
    eligible: boolean
    restrictions: number
  }
  final_recommendation: 'AUTO_APPROVE' | 'MANAGER_REVIEW' | 'reject'
  recommendation_reasoning: string
  required_actions: string[]
  approval_workflow: {
    requires_manager_approval: boolean
    required_approval_level: string
    auto_approvable: boolean
  }
}

// Manager Approval Response
interface ApprovalResult {
  decision_processed: boolean
  expense_status: 'approved' | 'rejected'
  decision_details: {
    manager_id: string
    decision: string
    rationale: string
    decision_timestamp: string
  }
  workflow_actions: {
    reimbursement_triggered: boolean
    employee_notified: boolean
    audit_record_created: boolean
    finance_team_notified: boolean
  }
  reimbursement_details?: {
    amount: number
    currency: string
    payment_method: string
    expected_processing_days: number
    reference_number: string
  }
  next_steps: string[]
  audit_trail: {
    record_id: string
    timestamp: string
    action: string
  }
}

// Expense Record
interface ExpenseRecord {
  id: string
  employee: string
  vendor: string
  amount: number
  date: string
  category: string
  status: 'pending' | 'approved' | 'rejected' | 'reviewing'
  riskScore: 'low' | 'medium' | 'high'
  validationResult?: ValidationResult
  receiptImage?: string
}

// ============================================================================
// AGENT IDs
// ============================================================================
const AGENT_IDS = {
  RECEIPT_EXTRACTION: '696a2d3ea5272eccb326c62f',
  FRAUD_DETECTION: '696a2d57a5272eccb326c639',
  POLICY_COMPLIANCE: '696a2d6d9ea90559bbf3e8e7',
  EMPLOYEE_ELIGIBILITY: '696a2d85a5272eccb326c648',
  EXPENSE_VALIDATION_COORDINATOR: '696a2da7a5272eccb326c65d',
  MANAGER_APPROVAL: '696a2dc7a5272eccb326c66b'
}

// ============================================================================
// SAMPLE DATA
// ============================================================================
const initialExpenses: ExpenseRecord[] = []

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-green-500'
    case 'rejected':
      return 'bg-red-500'
    case 'pending':
      return 'bg-yellow-500'
    case 'reviewing':
      return 'bg-blue-500'
    default:
      return 'bg-gray-500'
  }
}

function getRiskColor(risk: string): string {
  switch (risk) {
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'high':
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// ============================================================================
// SUB-COMPONENTS (defined outside Home to prevent re-creation)
// ============================================================================

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const color = getStatusColor(status)
  return (
    <Badge className={cn('capitalize', color, 'text-white border-0')}>
      {status}
    </Badge>
  )
}

// Risk Badge Component
function RiskBadge({ risk }: { risk: string }) {
  const color = getRiskColor(risk)
  return (
    <Badge variant="outline" className={cn('capitalize', color)}>
      {risk} risk
    </Badge>
  )
}

// File Upload Component
function FileUploadZone({
  onFileSelect,
  preview
}: {
  onFileSelect: (file: File) => void
  preview?: string
}) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      )}
    >
      {preview ? (
        <div className="space-y-2">
          {preview.startsWith('data:application/pdf') ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-16 w-16 text-red-600" />
              <p className="text-sm font-medium text-gray-700">PDF Receipt Uploaded</p>
            </div>
          ) : (
            <img src={preview} alt="Receipt preview" className="max-h-48 mx-auto rounded" />
          )}
          <p className="text-sm text-gray-500">Receipt uploaded successfully</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div>
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">Upload a file</span>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileInput}
              />
            </label>
            <span className="text-gray-600"> or drag and drop</span>
          </div>
          <p className="text-xs text-gray-500">PDF, PNG, JPG, GIF up to 10MB</p>
        </div>
      )}
    </div>
  )
}

// Expense Table Row Component
function ExpenseTableRow({
  expense,
  onSelect,
  isSelected
}: {
  expense: ExpenseRecord
  onSelect: () => void
  isSelected: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <TableRow
        className={cn(
          'cursor-pointer hover:bg-gray-50',
          isSelected && 'bg-blue-50'
        )}
        onClick={onSelect}
      >
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{expense.id}</TableCell>
        <TableCell>{formatDate(expense.date)}</TableCell>
        <TableCell>{expense.vendor}</TableCell>
        <TableCell>{formatCurrency(expense.amount)}</TableCell>
        <TableCell>{expense.category}</TableCell>
        <TableCell><StatusBadge status={expense.status} /></TableCell>
        <TableCell><RiskBadge risk={expense.riskScore} /></TableCell>
      </TableRow>
      {expanded && expense.validationResult && (
        <TableRow>
          <TableCell colSpan={8} className="bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold mb-1">Fraud Analysis</p>
                <p>Score: {(expense.validationResult.fraud_analysis.fraud_score * 100).toFixed(0)}%</p>
                <p>Flags: {expense.validationResult.fraud_analysis.flags_count}</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Policy Compliance</p>
                <p>Status: {expense.validationResult.policy_compliance.compliant ? 'Compliant' : 'Non-Compliant'}</p>
                <p>Violations: {expense.validationResult.policy_compliance.violations_count}</p>
              </div>
              <div className="col-span-2">
                <p className="font-semibold mb-1">Recommendation</p>
                <p className="text-gray-700">{expense.validationResult.recommendation_reasoning}</p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// Validation Progress Component
function ValidationProgress({ stage }: { stage: number }) {
  const stages = [
    { name: 'Receipt Extraction', icon: FileText },
    { name: 'Fraud Detection', icon: Shield },
    { name: 'Policy Check', icon: ClipboardCheck },
    { name: 'Eligibility', icon: User },
    { name: 'Final Review', icon: FileCheck }
  ]

  return (
    <div className="space-y-3">
      {stages.map((s, idx) => {
        const Icon = s.icon
        const isActive = idx === stage
        const isComplete = idx < stage

        return (
          <div key={s.name} className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              isComplete ? 'bg-green-500 text-white' :
              isActive ? 'bg-blue-500 text-white' :
              'bg-gray-200 text-gray-500'
            )}>
              {isComplete ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <div className="flex-1">
              <p className={cn(
                'text-sm font-medium',
                isActive && 'text-blue-600',
                isComplete && 'text-green-600'
              )}>
                {s.name}
              </p>
            </div>
            {isActive && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Home() {
  // Navigation state
  const [currentView, setCurrentView] = useState<'employee' | 'manager' | 'audit'>('employee')

  // Employee Dashboard state
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string>('')
  const [expenseData, setExpenseData] = useState({
    vendor: '',
    amount: '',
    date: '',
    category: 'Business Meal'
  })
  const [isValidating, setIsValidating] = useState(false)
  const [validationStage, setValidationStage] = useState(0)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Expenses list state
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialExpenses)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Manager Review state
  const [managerRationale, setManagerRationale] = useState('')
  const [isProcessingApproval, setIsProcessingApproval] = useState(false)
  const [approvalResult, setApprovalResult] = useState<ApprovalResult | null>(null)

  // Audit Log state
  const [auditFilters, setAuditFilters] = useState({
    dateFrom: '',
    dateTo: '',
    employee: '',
    status: 'all'
  })

  // ============================================================================
  // HANDLERS - Employee Dashboard
  // ============================================================================

  const handleFileSelect = useCallback((file: File) => {
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setReceiptPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleExpenseDataChange = useCallback((field: string, value: string) => {
    setExpenseData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSubmitExpense = async () => {
    setIsValidating(true)
    setValidationError(null)
    setValidationResult(null)
    setValidationStage(0)

    try {
      // Simulate validation stages
      const stages = [
        { name: 'Extracting receipt data...', delay: 800 },
        { name: 'Checking for fraud...', delay: 1000 },
        { name: 'Validating policy compliance...', delay: 900 },
        { name: 'Verifying employee eligibility...', delay: 700 },
        { name: 'Generating final report...', delay: 600 }
      ]

      for (let i = 0; i < stages.length; i++) {
        setValidationStage(i)
        await new Promise(resolve => setTimeout(resolve, stages[i].delay))
      }

      // Call Expense Validation Coordinator
      const message = `Validate expense: Vendor: ${expenseData.vendor}, Amount: $${expenseData.amount}, Date: ${expenseData.date}, Category: ${expenseData.category}, Employee: Current User`

      const result = await callAIAgent(message, AGENT_IDS.EXPENSE_VALIDATION_COORDINATOR)

      if (result.success && result.response) {
        // Parse the nested response structure
        let validationData: ValidationResult

        if (typeof result.response.response === 'string') {
          const parsedResponse = JSON.parse(result.response.response)
          validationData = parsedResponse.result as ValidationResult
        } else if (result.response.result) {
          validationData = result.response.result as ValidationResult
        } else {
          throw new Error('Invalid response structure')
        }

        setValidationResult(validationData)

        // Add to expenses list
        const newExpense: ExpenseRecord = {
          id: `EXP-2026-${String(expenses.length + 1).padStart(3, '0')}`,
          employee: 'Current User',
          vendor: expenseData.vendor,
          amount: parseFloat(expenseData.amount),
          date: expenseData.date,
          category: expenseData.category,
          status: validationData.final_recommendation === 'AUTO_APPROVE' ? 'approved' :
                  validationData.final_recommendation === 'MANAGER_REVIEW' ? 'reviewing' : 'rejected',
          riskScore: validationData.validation_summary.risk_level,
          validationResult: validationData
        }
        setExpenses(prev => [newExpense, ...prev])
      } else {
        setValidationError(result.error || 'Validation failed')
      }
    } catch (error) {
      setValidationError('Network error occurred')
    } finally {
      setIsValidating(false)
      setValidationStage(5)
    }
  }

  // ============================================================================
  // HANDLERS - Manager Review
  // ============================================================================

  const handleApprovalDecision = async (decision: 'approve' | 'reject') => {
    if (!selectedExpense) return

    setIsProcessingApproval(true)
    setApprovalResult(null)

    try {
      const message = `Process approval decision: Expense ID: ${selectedExpense.id}, Employee: ${selectedExpense.employee}, Amount: $${selectedExpense.amount}, Manager Decision: ${decision.toUpperCase()}, Rationale: ${managerRationale}`

      const result = await callAIAgent(message, AGENT_IDS.MANAGER_APPROVAL)

      if (result.success && result.response) {
        // Parse the nested response structure
        let approvalData: ApprovalResult

        if (typeof result.response.response === 'string') {
          const parsedResponse = JSON.parse(result.response.response)
          approvalData = parsedResponse.result as ApprovalResult
        } else if (result.response.result) {
          approvalData = result.response.result as ApprovalResult
        } else {
          throw new Error('Invalid response structure')
        }

        setApprovalResult(approvalData)

        // Update expense status
        setExpenses(prev => prev.map(exp =>
          exp.id === selectedExpense.id
            ? { ...exp, status: approvalData.expense_status }
            : exp
        ))

        // Clear rationale
        setManagerRationale('')
      }
    } catch (error) {
      console.error('Approval processing error:', error)
    } finally {
      setIsProcessingApproval(false)
    }
  }

  // ============================================================================
  // FILTERED DATA
  // ============================================================================

  const filteredExpenses = expenses.filter(exp => {
    if (statusFilter === 'all') return true
    return exp.status === statusFilter
  })

  const pendingExpenses = expenses.filter(e => e.status === 'reviewing' || e.status === 'pending')

  // ============================================================================
  // RENDER - Employee Dashboard
  // ============================================================================

  const renderEmployeeDashboard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Expense Submission */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Submit New Expense
            </CardTitle>
            <CardDescription>Upload receipt and fill in expense details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Upload */}
            <div>
              <Label>Receipt Document</Label>
              <FileUploadZone
                onFileSelect={handleFileSelect}
                preview={receiptPreview}
              />
            </div>

            <Separator />

            {/* Expense Details */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="vendor">Vendor Name</Label>
                <Input
                  id="vendor"
                  placeholder="e.g., Starbucks Coffee"
                  value={expenseData.vendor}
                  onChange={(e) => handleExpenseDataChange('vendor', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-9"
                      value={expenseData.amount}
                      onChange={(e) => handleExpenseDataChange('amount', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="date">Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      id="date"
                      type="date"
                      className="pl-9"
                      value={expenseData.date}
                      onChange={(e) => handleExpenseDataChange('date', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={expenseData.category}
                  onValueChange={(value) => handleExpenseDataChange('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Business Meal">Business Meal</SelectItem>
                    <SelectItem value="Client Entertainment">Client Entertainment</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                    <SelectItem value="Home Office Equipment">Home Office Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSubmitExpense}
              disabled={isValidating || !expenseData.vendor || !expenseData.amount || !expenseData.date}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <FileCheck className="mr-2 h-4 w-4" />
                  Submit Expense
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Validation Progress */}
        {isValidating && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Validation Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ValidationProgress stage={validationStage} />
            </CardContent>
          </Card>
        )}

        {/* Validation Result */}
        {validationResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {validationResult.final_recommendation === 'AUTO_APPROVE' && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                {validationResult.final_recommendation === 'MANAGER_REVIEW' && (
                  <Clock className="h-5 w-5 text-blue-600" />
                )}
                {validationResult.final_recommendation === 'reject' && (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                Validation Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Status</span>
                <StatusBadge status={validationResult.validation_summary.overall_status} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Risk Level</span>
                <RiskBadge risk={validationResult.validation_summary.risk_level} />
              </div>

              <div>
                <span className="text-sm font-medium">Confidence Score</span>
                <Progress
                  value={validationResult.validation_summary.confidence_score * 100}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {(validationResult.validation_summary.confidence_score * 100).toFixed(0)}%
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Recommendation</p>
                <p className="text-sm text-gray-700">{validationResult.recommendation_reasoning}</p>
              </div>

              {validationResult.required_actions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Required Actions</p>
                  <ul className="space-y-1">
                    {validationResult.required_actions.map((action, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Validation Error</AlertTitle>
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Right Column - Recent Expenses */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Expenses</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.length > 0 ? (
                    filteredExpenses.map(expense => (
                      <ExpenseTableRow
                        key={expense.id}
                        expense={expense}
                        onSelect={() => setSelectedExpense(expense)}
                        isSelected={selectedExpense?.id === expense.id}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="h-12 w-12 text-gray-300" />
                          <p className="text-sm">No expenses yet</p>
                          <p className="text-xs">Submit your first expense to get started</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  // ============================================================================
  // RENDER - Manager Review Queue
  // ============================================================================

  const renderManagerReview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Queue List */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Review Queue
            </CardTitle>
            <CardDescription>{pendingExpenses.length} items pending</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[700px]">
              <div className="space-y-3">
                {pendingExpenses.map(expense => (
                  <Card
                    key={expense.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-gray-50',
                      selectedExpense?.id === expense.id && 'ring-2 ring-blue-500'
                    )}
                    onClick={() => setSelectedExpense(expense)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{expense.employee}</p>
                          <p className="text-xs text-gray-500">{expense.id}</p>
                        </div>
                        <RiskBadge risk={expense.riskScore} />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{expense.vendor}</span>
                        <span className="font-semibold">{formatCurrency(expense.amount)}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(expense.date)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {pendingExpenses.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">All caught up!</p>
                    <p className="text-xs">No expenses pending review</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Validation Report */}
      <div className="lg:col-span-2">
        {selectedExpense ? (
          <Card>
            <CardHeader>
              <CardTitle>Expense Review - {selectedExpense.id}</CardTitle>
              <CardDescription>
                {selectedExpense.employee} - {formatCurrency(selectedExpense.amount)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Vendor</p>
                  <p className="text-lg">{selectedExpense.vendor}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Category</p>
                  <p className="text-lg">{selectedExpense.category}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Amount</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedExpense.amount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Date</p>
                  <p className="text-lg">{formatDate(selectedExpense.date)}</p>
                </div>
              </div>

              <Separator />

              {/* Validation Details */}
              {selectedExpense.validationResult ? (
                <Tabs defaultValue="receipt">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="receipt">Receipt Data</TabsTrigger>
                    <TabsTrigger value="fraud">Fraud Analysis</TabsTrigger>
                    <TabsTrigger value="policy">Policy Check</TabsTrigger>
                    <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
                  </TabsList>

                  <TabsContent value="receipt" className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Extraction Status</span>
                        <Badge variant={selectedExpense.validationResult.receipt_data.extracted_successfully ? 'default' : 'destructive'}>
                          {selectedExpense.validationResult.receipt_data.extracted_successfully ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Vendor</p>
                          <p className="font-medium">{selectedExpense.validationResult.receipt_data.vendor}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Amount</p>
                          <p className="font-medium">{formatCurrency(selectedExpense.validationResult.receipt_data.amount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Date</p>
                          <p className="font-medium">{selectedExpense.validationResult.receipt_data.date}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="fraud" className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Fraud Risk</span>
                        <Badge variant={selectedExpense.validationResult.fraud_analysis.fraud_detected ? 'destructive' : 'default'}>
                          {selectedExpense.validationResult.fraud_analysis.fraud_detected ? 'Detected' : 'Clear'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Fraud Score</p>
                        <Progress value={selectedExpense.validationResult.fraud_analysis.fraud_score * 100} />
                        <p className="text-xs text-gray-500 mt-1">
                          {(selectedExpense.validationResult.fraud_analysis.fraud_score * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Flags ({selectedExpense.validationResult.fraud_analysis.flags_count})</p>
                        {selectedExpense.validationResult.fraud_analysis.flags_count > 0 ? (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              {selectedExpense.validationResult.fraud_analysis.flags_count} fraud indicators detected
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>No fraud indicators detected</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="policy" className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Compliance Status</span>
                        <Badge variant={selectedExpense.validationResult.policy_compliance.compliant ? 'default' : 'destructive'}>
                          {selectedExpense.validationResult.policy_compliance.compliant ? 'Compliant' : 'Non-Compliant'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Violations</p>
                        {selectedExpense.validationResult.policy_compliance.violations_count > 0 ? (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              {selectedExpense.validationResult.policy_compliance.violations_count} policy violations found
                              {selectedExpense.validationResult.policy_compliance.critical_violations && ' (critical)'}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>No policy violations</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="eligibility" className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Eligibility Status</span>
                        <Badge variant={selectedExpense.validationResult.employee_eligibility.eligible ? 'default' : 'destructive'}>
                          {selectedExpense.validationResult.employee_eligibility.eligible ? 'Eligible' : 'Not Eligible'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Restrictions</p>
                        {selectedExpense.validationResult.employee_eligibility.restrictions > 0 ? (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              {selectedExpense.validationResult.employee_eligibility.restrictions} eligibility restrictions
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>No eligibility restrictions</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>No validation data available for this expense</AlertDescription>
                </Alert>
              )}

              <Separator />

              {/* Manager Action */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="rationale">Decision Rationale</Label>
                  <Textarea
                    id="rationale"
                    placeholder="Enter your reasoning for approval or rejection..."
                    value={managerRationale}
                    onChange={(e) => setManagerRationale(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="default"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprovalDecision('approve')}
                    disabled={isProcessingApproval || !managerRationale}
                  >
                    {isProcessingApproval ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleApprovalDecision('reject')}
                    disabled={isProcessingApproval || !managerRationale}
                  >
                    {isProcessingApproval ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Reject
                  </Button>
                </div>
              </div>

              {/* Approval Result */}
              {approvalResult && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Decision Processed</AlertTitle>
                  <AlertDescription className="text-green-700">
                    <p className="mb-2">Expense {approvalResult.expense_status}</p>
                    {approvalResult.reimbursement_details && (
                      <div className="text-sm space-y-1">
                        <p>Reimbursement: {formatCurrency(approvalResult.reimbursement_details.amount)}</p>
                        <p>Reference: {approvalResult.reimbursement_details.reference_number}</p>
                        <p>Processing: {approvalResult.reimbursement_details.expected_processing_days} business days</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-[700px] text-gray-500">
              <div className="text-center">
                <ClipboardCheck className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No Expense Selected</p>
                <p className="text-sm">Select an expense from the queue to review</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )

  // ============================================================================
  // RENDER - Audit Log
  // ============================================================================

  const renderAuditLog = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Audit Log
        </CardTitle>
        <CardDescription>Complete expense transaction history</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="dateFrom">Date From</Label>
            <Input
              id="dateFrom"
              type="date"
              value={auditFilters.dateFrom}
              onChange={(e) => setAuditFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="dateTo">Date To</Label>
            <Input
              id="dateTo"
              type="date"
              value={auditFilters.dateTo}
              onChange={(e) => setAuditFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="employee">Employee</Label>
            <Input
              id="employee"
              placeholder="Search employee..."
              value={auditFilters.employee}
              onChange={(e) => setAuditFilters(prev => ({ ...prev, employee: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={auditFilters.status}
              onValueChange={(value) => setAuditFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Apply Filters
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Expense ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Risk Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length > 0 ? (
                expenses.map(expense => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell className="font-medium">{expense.id}</TableCell>
                    <TableCell>{expense.employee}</TableCell>
                    <TableCell>{expense.vendor}</TableCell>
                    <TableCell>{formatCurrency(expense.amount)}</TableCell>
                    <TableCell className="text-sm">{expense.category}</TableCell>
                    <TableCell><StatusBadge status={expense.status} /></TableCell>
                    <TableCell><RiskBadge risk={expense.riskScore} /></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <FileCheck className="h-12 w-12 text-gray-300" />
                      <p className="text-sm">No audit records</p>
                      <p className="text-xs">Expense transactions will appear here</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 rounded-lg p-2">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Expense Management</h1>
                <p className="text-xs text-gray-500">Automated validation platform</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                <User className="h-3 w-3 mr-1" />
                Current User
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1">
            <button
              onClick={() => setCurrentView('employee')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                currentView === 'employee'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              <div className="flex items-center gap-2">
                <HomeIcon className="h-4 w-4" />
                Employee Dashboard
              </div>
            </button>
            <button
              onClick={() => setCurrentView('manager')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                currentView === 'manager'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Manager Review
                {pendingExpenses.length > 0 && (
                  <Badge className="bg-red-500 text-white">{pendingExpenses.length}</Badge>
                )}
              </div>
            </button>
            <button
              onClick={() => setCurrentView('audit')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                currentView === 'audit'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Audit Log
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'employee' && renderEmployeeDashboard()}
        {currentView === 'manager' && renderManagerReview()}
        {currentView === 'audit' && renderAuditLog()}
      </main>
    </div>
  )
}
