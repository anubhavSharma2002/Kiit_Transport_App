import { useState } from 'react'
import { Phone, Mail, MessageCircle, Send } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Support() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

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
      setFormData({ name: '', email: '', subject: '', message: '' })
      setTimeout(() => setSubmitted(false), 3000)
    }, 1500)
  }

  const sections = [
    { icon: Phone, title: "Phone Support", value: "+91 98765 43210", sub: "Available 24/7" },
    { icon: Mail, title: "Email Us", value: "transport@kiit.ac.in", sub: "Response < 2 hours" },
    { icon: MessageCircle, title: "Live Chat", value: "Chat Now", sub: "Mon-Fri, 9am - 5pm" }
  ]

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-8 pb-24">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            How can we help?
          </h1>
          <p className="text-slate-500 max-w-lg mx-auto">
            Get in touch with our transport team for any queries, lost items, or general assistance.
          </p>
        </div>

        {/* CONTACT METHODS */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {sections.map((s, i) => (
            <Card key={i} className="text-center !p-8 border-0 shadow-lg shadow-slate-200/50" hover delay={i * 0.1}>
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <s.icon size={26} />
              </div>
              <h3 className="font-bold text-slate-800 mb-1">{s.title}</h3>
              <p className="text-blue-600 font-bold text-lg mb-1">{s.value}</p>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                {s.sub}
              </p>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-10">

          {/* CONTACT FORM */}
          <Card className="!p-8 border-0 shadow-xl shadow-slate-200/50">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                Send a Message
              </h3>
              <p className="text-slate-500 text-sm">
                We usually respond within a few hours.
              </p>
            </div>

            {submitted ? (
              <div className="bg-emerald-50 text-emerald-800 p-6 rounded-xl flex items-center gap-4">
                <div className="bg-white p-2 rounded-full shadow-sm">
                  <Send size={18} />
                </div>
                <div>
                  <p className="font-bold">Message Sent!</p>
                  <p className="text-sm text-slate-500">
                    We'll get back to you shortly.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <Input
                    label="Name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Name"
                  />
                  <Input
                    label="Email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="Email"
                    type="email"
                  />
                </div>

                <Input
                  label="Subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  placeholder="Topic of inquiry"
                />

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Message
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows="4"
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
                    placeholder="How can we help you today?"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  isLoading={loading}
                  icon={Send}
                >
                  Send Message
                </Button>
              </form>
            )}
          </Card>

          {/* FAQ */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800 px-2">
              Common Questions
            </h3>

            {[
              { q: "How do I see live bus location?", a: "Go to the 'Live Tracking' tab and select your route number." },
              { q: "Can I book a seat in advance?", a: "Yes, use the 'Select Route' page to find and book available seats up to 24h in advance." },
              { q: "What if I lose something on the bus?", a: "Please file a report in the Complaints section or contact us immediately." },
              { q: "Are the timings accurate?", a: "Bus timings are updated daily. Live tracking provides the most accurate real-time ETA." }
            ].map((item, idx) => (
              <Card
                key={idx}
                className="!p-5 border-l-4 border-l-blue-200 hover:border-l-blue-600 transition-colors cursor-pointer"
              >
                <h4 className="font-bold text-slate-800 mb-2 text-sm">
                  {item.q}
                </h4>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {item.a}
                </p>
              </Card>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}