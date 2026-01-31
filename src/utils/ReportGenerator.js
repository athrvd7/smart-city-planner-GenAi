/* ========================================
   Smart City Planner - PDF Report Generator
   ======================================== */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ZONE_TYPES } from './constants.js';
import { formatNumber } from './helpers.js';

export class ReportGenerator {
    constructor(city, metrics) {
        this.city = city;
        this.metrics = metrics;
    }

    /**
     * Generate and download PDF report
     * @param {HTMLCanvasElement} cityCanvas - The city visualization canvas
     */
    async generatePDF(cityCanvas) {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;

        // Colors
        const primaryColor = [0, 212, 170];
        const textColor = [50, 50, 50];
        const mutedColor = [120, 120, 120];

        // ========== HEADER ==========
        pdf.setFillColor(10, 14, 23);
        pdf.rect(0, 0, pageWidth, 45, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Smart City Planning Report', margin, 25);

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(180, 180, 180);
        pdf.text(`Generated: ${new Date().toLocaleDateString()} | City ID: ${this.city.id}`, margin, 35);

        y = 55;

        // ========== CITY OVERVIEW ==========
        pdf.setTextColor(...textColor);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('City Overview', margin, y);
        y += 10;

        const allMetrics = this.metrics.getAll();

        // Overview table
        const overviewData = [
            ['City Name', this.city.name],
            ['Grid Size', `${this.city.gridSize} × ${this.city.gridSize}`],
            ['Total Population', formatNumber(allMetrics.population)],
            ['Sustainability Score', `${allMetrics.sustainabilityScore}/100`]
        ];

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        overviewData.forEach(([label, value]) => {
            pdf.setTextColor(...mutedColor);
            pdf.text(label + ':', margin, y);
            pdf.setTextColor(...textColor);
            pdf.text(value.toString(), margin + 45, y);
            y += 6;
        });

        y += 10;

        // ========== CITY MAP ==========
        pdf.setTextColor(...textColor);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('City Layout', margin, y);
        y += 8;

        try {
            // Capture canvas as image
            const canvasImage = cityCanvas.toDataURL('image/png');
            const imgWidth = pageWidth - 2 * margin;
            const imgHeight = imgWidth * (cityCanvas.height / cityCanvas.width);

            // Check if fits on page
            if (y + imgHeight > pageHeight - 20) {
                pdf.addPage();
                y = margin;
            }

            pdf.addImage(canvasImage, 'PNG', margin, y, imgWidth, Math.min(imgHeight, 100));
            y += Math.min(imgHeight, 100) + 15;
        } catch (error) {
            console.error('Failed to add canvas image:', error);
            y += 10;
        }

        // ========== SUSTAINABILITY METRICS ==========
        if (y > pageHeight - 80) {
            pdf.addPage();
            y = margin;
        }

        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Sustainability Metrics', margin, y);
        y += 10;

        const metricsData = [
            ['Sustainability Score', allMetrics.sustainabilityScore + '/100', this.getRating(allMetrics.sustainabilityScore)],
            ['Carbon Footprint', allMetrics.carbonFootprint.label, allMetrics.carbonFootprint.value <= 0 ? '✓' : '!'],
            ['Energy Efficiency', allMetrics.energyEfficiency.label, this.getRating(allMetrics.energyEfficiency.value)],
            ['Green Coverage', allMetrics.greenCoverage.label, this.getRating(allMetrics.greenCoverage.value * 2.5)],
            ['Transit Score', allMetrics.transitScore.label, this.getRating(allMetrics.transitScore.value)],
            ['Walkability', allMetrics.walkability.label, this.getRating(allMetrics.walkability.value)],
            ['Air Quality', allMetrics.airQuality.label, allMetrics.airQuality.status]
        ];

        pdf.setFontSize(10);
        metricsData.forEach(([label, value, status]) => {
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...mutedColor);
            pdf.text(label, margin, y);

            pdf.setTextColor(...textColor);
            pdf.text(value, margin + 50, y);

            // Status indicator
            if (status === 'excellent' || status === '✓') {
                pdf.setTextColor(34, 197, 94);
            } else if (status === 'good') {
                pdf.setTextColor(59, 130, 246);
            } else if (status === 'fair' || status === '!') {
                pdf.setTextColor(245, 158, 11);
            } else {
                pdf.setTextColor(239, 68, 68);
            }
            pdf.text(status.charAt(0).toUpperCase() + status.slice(1), margin + 80, y);

            y += 7;
        });

        y += 10;

        // ========== ZONE DISTRIBUTION ==========
        if (y > pageHeight - 60) {
            pdf.addPage();
            y = margin;
        }

        pdf.setTextColor(...textColor);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Zone Distribution', margin, y);
        y += 10;

        const zoneData = allMetrics.zoneDistribution;
        const barWidth = 100;
        const barHeight = 8;

        pdf.setFontSize(9);
        zoneData.labels.forEach((label, i) => {
            const pct = zoneData.data[i];
            const color = this.hexToRgb(zoneData.colors[i]);

            // Label
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...mutedColor);
            pdf.text(label, margin, y + 5);

            // Bar background
            pdf.setFillColor(230, 230, 230);
            pdf.rect(margin + 35, y, barWidth, barHeight, 'F');

            // Bar fill
            pdf.setFillColor(...color);
            pdf.rect(margin + 35, y, barWidth * (pct / 100), barHeight, 'F');

            // Percentage
            pdf.setTextColor(...textColor);
            pdf.text(`${pct}%`, margin + 35 + barWidth + 5, y + 5);

            y += 12;
        });

        y += 10;

        // ========== RECOMMENDATIONS ==========
        if (y > pageHeight - 50) {
            pdf.addPage();
            y = margin;
        }

        const recommendations = this.metrics.getRecommendations();
        if (recommendations.length > 0) {
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...textColor);
            pdf.text('Recommendations', margin, y);
            y += 10;

            pdf.setFontSize(10);
            recommendations.forEach((rec, i) => {
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(...primaryColor);
                pdf.text(`${i + 1}. ${rec.title}`, margin, y);
                y += 5;

                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(...mutedColor);
                const lines = pdf.splitTextToSize(rec.description, pageWidth - 2 * margin);
                lines.forEach(line => {
                    pdf.text(line, margin + 5, y);
                    y += 5;
                });

                pdf.setTextColor(34, 197, 94);
                pdf.text(`Impact: ${rec.impact}`, margin + 5, y);
                y += 10;
            });
        }

        // ========== FOOTER ==========
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(...mutedColor);
            pdf.text(
                `Smart City Planner | Page ${i} of ${totalPages}`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
        }

        // Save PDF
        pdf.save(`smart-city-report-${this.city.id}.pdf`);

        return true;
    }

    /**
     * Get rating text from score
     */
    getRating(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    }

    /**
     * Convert hex color to RGB array
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [100, 100, 100];
    }
}
