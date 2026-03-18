import { useState } from 'react'
import { AlertCircle, CheckCircle } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Complaints() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    busNumber: '',
    date: '',
    title: '',
    description: '',
    category: '',
  })

  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const categories = [
    'Bus Condition',
    'Driver Behavior',
    'Schedule Delay',
    'Safety Issue',
    'Lost and Found',
    'Other',
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)

    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
      setFormData({
        name: '',
        email: '',
        busNumber: '',
        date: '',
        title: '',
        description: '',
        category: '',
      })

      setTimeout(() => setSubmitted(false), 5000)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-8 pb-24">
      <div className="max-w-3xl mx-auto">

        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            File a Complaint
          </h1>
          <p className="text-slate-500">
            We take your feedback seriously. Let us know what happened.
          </p>
        </div>

        {submitted ? (
          <Card className="text-center py-12 !border-l-4 !border-l-emerald-500 shadow-xl shadow-emerald-100/50">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={36} />
            </div>

            <h3 className="text-2xl font-bold text-slate-800 mb-2">
              Complaint Submitted
            </h3>

            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Your reference ID is{" "}
              <span className="font-mono font-bold text-slate-800">
                #CMP-{Math.floor(Math.random() * 10000)}
              </span>.
              We will review your report and update you within 48 hours.
            </p>

            <Button
              onClick={() => setSubmitted(false)}
              variant="outline"
            >
              File Another Report
            </Button>
          </Card>
        ) : (
          <Card className="!p-8 border-0 shadow-lg shadow-slate-200/50">
            <form onSubmit={handleSubmit} className="space-y-6">

              <div className="grid md:grid-cols-2 gap-6">
                <Input
                  label="Your Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="student@kiit.ac.in"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Input
                  label="Bus Number (Optional)"
                  name="busNumber"
                  value={formData.busNumber}
                  onChange={handleChange}
                  placeholder="e.g. UT-205"
                />
                <Input
                  label="Date of Incident"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="
                    w-full
                    px-4 py-3
                    bg-slate-50
                    border border-slate-200
                    rounded-xl
                    focus:outline-none
                    focus:ring-2
                    focus:ring-blue-500/20
                    focus:border-blue-600
                    transition-all
                    text-slate-800
                    font-medium
                    appearance-none
                  "
                >
                  <option value="">Select a category...</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Subject"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Brief summary of the issue"
                required
              />

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="5"
                  required
                  className="
                    w-full
                    px-4 py-3
                    bg-slate-50
                    border border-slate-200
                    rounded-xl
                    focus:outline-none
                    focus:ring-2
                    focus:ring-blue-500/20
                    focus:border-blue-600
                    transition-all
                    text-slate-800
                    font-medium
                    resize-none
                    placeholder:text-slate-400
                  "
                  placeholder="Please describe the incident in detail..."
                />
              </div>

              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex gap-3 text-sm">
                <AlertCircle className="shrink-0" size={18} />
                <p>
                  Your report is confidential. False reporting may lead to disciplinary action.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full py-4 text-lg"
                isLoading={loading}
              >
                Submit Complaint
              </Button>

            </form>
          </Card>
        )}
      </div>
    </div>
  )
}