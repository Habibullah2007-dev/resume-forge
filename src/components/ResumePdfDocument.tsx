import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

export interface ResumeItem {
  title?: string;
  subtitle?: string;
  date?: string;
  bullets?: string[];
  paragraphs?: string[];
}

export const parsePdfResumeSection = (text: string): ResumeItem[] => {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items: ResumeItem[] = [];
  let currentItem: ResumeItem | null = null;

  const isBulletLine = (line: string) => {
    return line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || line.startsWith('o ');
  };

  const cleanBulletText = (line: string) => {
    return line.replace(/^[-•*o]\s*/, '').trim();
  };

  const extractDate = (line: string): { cleanLine: string; date: string } => {
    const parenRegex = /\(([^)]*(?:\b(19|20)\d{2}\b|\bPresent\b)[^)]*)\)/i;
    const parenMatch = line.match(parenRegex);
    if (parenMatch) {
      const date = parenMatch[1].trim();
      const cleanLine = line.replace(parenMatch[0], '').replace(/\s{2,}/g, ' ').trim();
      return { cleanLine, date };
    }

    const dateAtEndRegex = /[\s,|-]*\b((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\s+\d{4}|\d{4})\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\s+\d{4}|\d{4}|Present)|(?:19|20)\d{2})\b\s*$/i;
    const endMatch = line.match(dateAtEndRegex);
    if (endMatch) {
      const date = endMatch[1].trim();
      const cleanLine = line.substring(0, endMatch.index).replace(/[\s,|-]+$/, '').trim();
      return { cleanLine, date };
    }

    return { cleanLine: line, date: '' };
  };

  const parseHeaderParts = (headerLine: string): { title: string; subtitle: string } => {
    if (headerLine.includes('|')) {
      const parts = headerLine.split('|').map(p => p.trim());
      return { title: parts[0], subtitle: parts.slice(1).join(', ') };
    }
    
    const atRegex = /\s+at\s+/i;
    if (atRegex.test(headerLine)) {
      const parts = headerLine.split(atRegex);
      return { title: parts[0].trim(), subtitle: parts[1].trim() };
    }

    if (headerLine.includes(',')) {
      const parts = headerLine.split(',').map(p => p.trim());
      return { title: parts[0], subtitle: parts.slice(1).join(', ') };
    }

    return { title: headerLine, subtitle: '' };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isBulletLine(line)) {
      const bulletContent = cleanBulletText(line);
      if (!currentItem) {
        currentItem = { bullets: [bulletContent], paragraphs: [] };
        items.push(currentItem);
      } else {
        if (!currentItem.bullets) currentItem.bullets = [];
        currentItem.bullets.push(bulletContent);
      }
    } else {
      const { cleanLine, date } = extractDate(line);

      if (date) {
        const { title, subtitle } = parseHeaderParts(cleanLine);
        currentItem = { title, subtitle, date, bullets: [], paragraphs: [] };
        items.push(currentItem);
      } else {
        const nextLine = lines[i + 1];
        if (nextLine && !isBulletLine(nextLine) && extractDate(nextLine).date !== '') {
          const title = line;
          const { cleanLine: subLine, date: nextDate } = extractDate(nextLine);
          currentItem = { title, subtitle: subLine, date: nextDate, bullets: [], paragraphs: [] };
          items.push(currentItem);
          i++;
        } else {
          if (line.length < 80) {
            const { title, subtitle } = parseHeaderParts(line);
            currentItem = { title, subtitle, bullets: [], paragraphs: [] };
            items.push(currentItem);
          } else {
            if (!currentItem) {
              currentItem = { paragraphs: [line], bullets: [] };
              items.push(currentItem);
            } else {
              if (!currentItem.paragraphs) currentItem.paragraphs = [];
              currentItem.paragraphs.push(line);
            }
          }
        }
      }
    }
  }

  return items;
};

export const parsePdfStructuredEducation = (text: string): ResumeItem[] => {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  const dateRangeRegex = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\s*(?:19|20)\d{2}\s*[-–—]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December|Present)?\s*(?:19|20)?\d{2})\b/i;
  const singleDateRegex = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)?\s*(?:19|20)\d{2})\b/i;

  const dates: string[] = [];
  const cleanTextLines: string[] = [];

  for (const line of lines) {
    let cleanLine = line;
    let extractedDate = '';

    const rangeMatch = line.match(dateRangeRegex);
    if (rangeMatch) {
      extractedDate = rangeMatch[1].trim();
      cleanLine = line.replace(rangeMatch[0], '').trim();
    } else {
      const singleMatch = line.match(singleDateRegex);
      if (singleMatch) {
        extractedDate = singleMatch[1].trim();
        cleanLine = line.replace(singleMatch[0], '').trim();
      }
    }

    if (extractedDate) {
      dates.push(extractedDate);
    }

    cleanLine = cleanLine.replace(/^[\s,|-]+|[\s,|-]+$/g, '').trim();
    if (cleanLine) {
      cleanTextLines.push(cleanLine);
    }
  }

  const entries: any[] = [];
  let current: any = null;

  const degreeKeywords = ['BACHELOR', 'MASTER', 'PH.D', 'DEGREE', 'DIPLOMA', 'B.S', 'M.S', 'B.SC', 'M.SC', 'B.A', 'M.A', 'B.TECH', 'B.E', 'HIGH SCHOOL', 'SECONDARY', 'CERTIFICATE', 'SSCE', 'LEAVING'];
  const instKeywords = ['UNIVERSITY', 'COLLEGE', 'SCHOOL', 'INSTITUTE', 'ACADEMY', 'POLYTECHNIC'];

  for (const line of cleanTextLines) {
    const upper = line.toUpperCase();
    const isDegree = degreeKeywords.some(k => upper.includes(k));
    const isInst = instKeywords.some(k => upper.includes(k));

    if (isDegree) {
      if (current && current.degree) {
        entries.push(current);
        current = null;
      }
      if (!current) current = { degree: '', institution: '', bullets: [] };
      current.degree = current.degree ? current.degree + ' ' + line : line;
    } else if (isInst) {
      if (current && current.institution) {
        entries.push(current);
        current = null;
      }
      if (!current) current = { degree: '', institution: '', bullets: [] };
      current.institution = current.institution ? current.institution + ' ' + line : line;
    } else {
      if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
        if (!current) current = { degree: '', institution: '', bullets: [] };
        current.bullets.push(line.replace(/^[-•*]\s*/, '').trim());
      } else if (line) {
        if (!current) {
          current = { degree: line, institution: '', bullets: [] };
        } else {
          if (current.institution) {
            current.institution += ', ' + line;
          } else if (current.degree) {
            current.institution = line;
          } else {
            current.degree = line;
          }
        }
      }
    }
  }
  if (current) {
    entries.push(current);
  }

  const items: ResumeItem[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const matchedDate = dates[i] || '';

    items.push({
      title: entry.degree || 'Degree/Diploma',
      subtitle: entry.institution || 'Institution Name',
      date: matchedDate,
      bullets: entry.bullets || []
    });
  }

  return items;
};

const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 45,
    paddingBottom: 45,
    paddingLeft: 50,
    paddingRight: 50,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: '#000000',
    lineHeight: 1.4,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  name: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#1F3864',
    marginBottom: 4,
  },
  contactLine: {
    fontSize: 9.5,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    width: '100%',
  },
  sectionContainer: {
    marginTop: 15,
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1F3864',
    borderBottomWidth: 1.5,
    borderBottomColor: '#1F3864',
    paddingBottom: 2,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 9.5,
    color: '#000000',
    textAlign: 'justify',
    marginBottom: 4,
  },
  boldInline: {
    fontFamily: 'Helvetica-Bold',
  },
  itemContainer: {
    marginBottom: 6,
  },
  itemHeaderLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: '#000000',
  },
  itemDate: {
    fontSize: 9,
    color: '#374151',
  },
  itemSubtitle: {
    fontSize: 9,
    color: '#6B7280',
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 2,
  },
  bulletList: {
    marginTop: 2,
    paddingLeft: 10,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bulletPoint: {
    width: 10,
    fontSize: 9.5,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
  }
});

interface ResumePdfDocumentProps {
  headerInfo: {
    name: string;
    subtitle?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  tailoredSummary: string;
  techSkills: string;
  softSkills: string;
  tailoredExperience: string;
  projects: string;
  education: string;
  certifications: string;
  awards: string;
  leadership: string;
  volunteer: string;
  publications: string;
  research: string;
  memberships: string;
  languages: string;
  interests: string;
  references: string;
}

export const ResumePdfDocument: React.FC<ResumePdfDocumentProps> = ({ 
  headerInfo, 
  tailoredSummary, 
  techSkills,
  softSkills,
  tailoredExperience, 
  projects,
  education, 
  certifications, 
  awards,
  leadership,
  volunteer,
  publications,
  research,
  memberships,
  languages,
  interests,
  references
}) => {
  const parsedExperience = parsePdfResumeSection(tailoredExperience);
  const parsedProjects = parsePdfResumeSection(projects);
  const parsedEducation = parsePdfStructuredEducation(education);
  const parsedCertifications = parsePdfResumeSection(certifications);
  const parsedAwards = parsePdfResumeSection(awards);
  const parsedLeadership = parsePdfResumeSection(leadership);
  const parsedVolunteer = parsePdfResumeSection(volunteer);
  const parsedPublications = parsePdfResumeSection(publications);
  const parsedResearch = parsePdfResumeSection(research);
  const parsedMemberships = parsePdfResumeSection(memberships);
  const parsedLanguages = parsePdfResumeSection(languages);
  const parsedReferences = parsePdfResumeSection(references);

  const renderPdfItem = (item: ResumeItem, idx: number) => (
    <View key={idx} style={pdfStyles.itemContainer} wrap={false}>
      {item.title && (
        <View style={pdfStyles.itemHeaderLine}>
          <Text style={pdfStyles.itemTitle}>{item.title}</Text>
          {item.date && <Text style={pdfStyles.itemDate}>{item.date}</Text>}
        </View>
      )}
      {item.subtitle && (
        <Text style={pdfStyles.itemSubtitle}>{item.subtitle}</Text>
      )}
      {item.paragraphs && item.paragraphs.map((p, pIdx) => (
        <Text key={pIdx} style={pdfStyles.bodyText}>{p}</Text>
      ))}
      {item.bullets && item.bullets.length > 0 && (
        <View style={pdfStyles.bulletList}>
          {item.bullets.map((b, bIdx) => (
            <View key={bIdx} style={pdfStyles.bulletItem}>
              <Text style={pdfStyles.bulletPoint}>•</Text>
              <Text style={pdfStyles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderPdfSkills = (skillsText: string) => {
    if (!skillsText) return null;
    const lines = skillsText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return (
      <View style={{ marginTop: 2 }}>
        {lines.map((line, idx) => {
          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1) {
            const category = line.substring(0, colonIdx).trim();
            const skills = line.substring(colonIdx + 1).trim();
            return (
              <Text key={idx} style={pdfStyles.bodyText}>
                <Text style={pdfStyles.boldInline}>{category}: </Text>
                {skills}
              </Text>
            );
          }
          return (
            <Text key={idx} style={pdfStyles.bodyText}>{line}</Text>
          );
        })}
      </View>
    );
  };

  const contactText = [
    headerInfo.location,
    headerInfo.phone,
    headerInfo.email,
    headerInfo.linkedin,
    headerInfo.github,
    headerInfo.portfolio
  ]
    .filter(Boolean)
    .join('  •  ');

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {/* 1. HEADER (small, compact, top of page only) */}
        <View style={pdfStyles.headerContainer}>
          <Text style={pdfStyles.name}>{headerInfo.name}</Text>
          {headerInfo.subtitle ? <Text style={pdfStyles.itemSubtitle}>{headerInfo.subtitle}</Text> : null}
          {contactText ? <Text style={pdfStyles.contactLine}>{contactText}</Text> : null}
          <View style={pdfStyles.divider} />
        </View>

        {/* 2. Professional Summary */}
        {tailoredSummary ? (
          <View style={pdfStyles.sectionContainer} wrap={false}>
            <Text style={pdfStyles.sectionHeader}>Professional Summary</Text>
            <Text style={pdfStyles.bodyText}>{tailoredSummary}</Text>
          </View>
        ) : null}

        {/* 3. Technical Skills */}
        {techSkills ? (
          <View style={pdfStyles.sectionContainer} wrap={false}>
            <Text style={pdfStyles.sectionHeader}>Technical Skills</Text>
            {renderPdfSkills(techSkills)}
          </View>
        ) : null}

        {/* 4. Soft Skills */}
        {softSkills ? (
          <View style={pdfStyles.sectionContainer} wrap={false}>
            <Text style={pdfStyles.sectionHeader}>Soft Skills</Text>
            {renderPdfSkills(softSkills)}
          </View>
        ) : null}

        {/* 5. Professional Experience */}
        {tailoredExperience && parsedExperience.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Professional Experience</Text>
            {parsedExperience.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 6. Projects */}
        {projects && parsedProjects.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Projects</Text>
            {parsedProjects.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 7. Education */}
        {education && parsedEducation.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Education</Text>
            {parsedEducation.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 8. Certifications */}
        {certifications && parsedCertifications.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Certifications</Text>
            {parsedCertifications.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 9. Awards & Achievements */}
        {awards && parsedAwards.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Awards & Achievements</Text>
            {parsedAwards.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 10. Leadership Experience */}
        {leadership && parsedLeadership.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Leadership Experience</Text>
            {parsedLeadership.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 11. Volunteer Experience */}
        {volunteer && parsedVolunteer.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Volunteer Experience</Text>
            {parsedVolunteer.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 12. Publications */}
        {publications && parsedPublications.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Publications</Text>
            {parsedPublications.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 13. Research Experience */}
        {research && parsedResearch.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Research Experience</Text>
            {parsedResearch.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 14. Professional Memberships */}
        {memberships && parsedMemberships.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Professional Memberships</Text>
            {parsedMemberships.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 15. Languages */}
        {languages && parsedLanguages.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>Languages</Text>
            {parsedLanguages.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}

        {/* 16. Interests */}
        {interests ? (
          <View style={pdfStyles.sectionContainer} wrap={false}>
            <Text style={pdfStyles.sectionHeader}>Interests</Text>
            <Text style={pdfStyles.bodyText}>{interests}</Text>
          </View>
        ) : null}

        {/* 17. References */}
        {references && parsedReferences.length > 0 ? (
          <View style={pdfStyles.sectionContainer}>
            <Text style={pdfStyles.sectionHeader}>References</Text>
            {parsedReferences.map((item, idx) => renderPdfItem(item, idx))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
};
