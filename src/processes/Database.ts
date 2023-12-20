import { LocalDateTime } from '@js-joda/core';
import { Mail } from '@sendgrid/helpers/classes';
import bluebird from 'bluebird';
import { CronJob } from 'cron';
import mongoose from 'mongoose';
import config from '../config';
import { Category, Token } from '../models';
import EmailService from '../services/EmailService';

const originalLog = console.log;

// Overwrite the console.log function using an arrow function
console.log = (...args: any[]) => {
  const currentDate = new Date().toISOString() + ' ||';
  originalLog(currentDate, ...args);
};

class Database {
  private readonly DELETE_TOKENS_DAYS = 1;
  private readonly SUBJECT = 'ALERT - Server - Database';

  public async run() {
    await this.connectToMongo();
    await this.createAndInsertSampleCategories();
    // this.cleanTokens();
  }

  private async connectToMongo() {
    console.log('Connecting to Mongo');
    // Configure promise with Bluebird and connect to MongoDB.
    mongoose.Promise = bluebird;
    await mongoose.connect(config.databaseUrl);
  }

  private cleanTokens() {
    const job = new CronJob(
      '0 */1 * * * *',
      async () => {
        try {
          await Token.deleteMany({
            expiration: {
              $lt: LocalDateTime.now().minusDays(this.DELETE_TOKENS_DAYS)
            }
          });
          console.log(
            `${new Date()} || Cleared tokens older than ${
              this.DELETE_TOKENS_DAYS
            } days old...`
          );
        } catch (err) {
          // Email me if this occurs
          await EmailService.sendEmail(
            new Mail({
              from: config.sendGrid.email.noReply,
              to: config.sendGrid.email.alert,
              subject: this.SUBJECT,
              html: EmailService.errorHtml(err)
            })
          );
        }
      },
      null,
      true,
      'America/Toronto'
    );

    console.log('Cleaning tokens running...');
    job.start();
  }

  private async createAndInsertSampleCategories() {
    try {
      // Connect to MongoDB if not already connected
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect('your-mongodb-connection-string'); // Replace with your MongoDB connection string
      }

      await Category.deleteMany({});
      // Define sample categories and their services
      const sampleCategories = [
        {
          name: 'Software',
          slug: 'software',
          services: [
            {
              name: 'Web Development',
              slug: 'web-development',
              description:
                'Design and development of websites and web applications.',
              thumbnailImg:
                'https://www.onlinecoursereport.com/wp-content/uploads/2020/07/shutterstock_394793860-1536x1177.jpg',
              slides: [
                {
                  text: 'Website',
                  image:
                    'https://www.onlinecoursereport.com/wp-content/uploads/2020/07/shutterstock_394793860-1536x1177.jpg'
                },
                {
                  text: 'Project Maintence',
                  image:
                    'https://www.onlinecoursereport.com/wp-content/uploads/2020/07/shutterstock_394793860-1536x1177.jpg'
                },
                {
                  text: 'Link Director',
                  image:
                    'https://www.onlinecoursereport.com/wp-content/uploads/2020/07/shutterstock_394793860-1536x1177.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: `You want to create something that people can access through a browser? Then You've selected the right service! I am able to create, maintain, and even upgrade any type of website.`
                },
                {
                  header: 'Programming Languages',
                  info: `This website you are looking at right now has a Typescript Nodejs server and a Vue Qausar client.
                  The languages and tools a website should use are best designed based off of what is required. Informational website should use static rendering like React x Nextjs and don't really need a seperate client server processes.
                  While more complex websites that require alot of work being done to create the product it is trying to produce might want additional processes connected via sockets. So we will pick the right language based off request.`
                },
                {
                  header: 'Price',
                  info: 'Informational - Per Page: $500. Multi-Process - TBD. Maintnence: $1000/month'
                },
                {
                  header: 'Service Time',
                  info: 'Informational - Per Page: 2 weeks. Multi-Process - TBD. (Based on how much work there is)'
                },
                {
                  header: 'Informational Ideas',
                  info: 'Informational: Blogs, Landing Pages, Routing Sites.'
                },
                {
                  header: 'Multi Process Ideas',
                  info: 'Multi Process: Real-Time Analytics Dashboard, Social Media Network, Healthcare Management System.'
                }
              ],
              faqs: [
                {
                  question: 'Can I turn my website into a app?',
                  answer:
                    'Yes. Yes you can. This website/app is a prime example. If you looking at this on the web, check your app store and view it from there.'
                }
              ]
            },
            {
              name: 'Mobile App Development',
              slug: 'mobile-app-development',
              description:
                'Creation of applications for mobile devices across various platforms.',
              thumbnailImg:
                'https://techiflyer.com/wp-content/uploads/2019/05/mobile-app-development-service-in-surat-techiflyer.png',
              slides: [
                {
                  text: 'Mobile App',
                  image:
                    'https://techiflyer.com/wp-content/uploads/2019/05/mobile-app-development-service-in-surat-techiflyer.png'
                },
                {
                  text: 'App Design',
                  image:
                    'https://techiflyer.com/wp-content/uploads/2019/05/mobile-app-development-service-in-surat-techiflyer.png'
                },
                {
                  text: 'App Development',
                  image:
                    'https://techiflyer.com/wp-content/uploads/2019/05/mobile-app-development-service-in-surat-techiflyer.png'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Mobile App Development service focuses on creating innovative and user-friendly mobile applications for iOS, Android, and other platforms.'
                },
                {
                  header: 'Technologies Used',
                  info: 'We utilize the latest technologies and frameworks, including React Native, Flutter, and native development, to deliver high-quality mobile apps.'
                },
                {
                  header: 'Price',
                  info: 'The cost of mobile app development varies based on project complexity. Contact us for a custom quote.'
                },
                {
                  header: 'Development Time',
                  info: 'Development time depends on the scope of the project. We provide estimated timelines after project assessment.'
                },
                {
                  header: 'App Types',
                  info: 'We develop various types of mobile apps, including e-commerce apps, social networking apps, and more.'
                },
                {
                  header: 'Support',
                  info: 'We offer ongoing support and maintenance services to ensure your app stays up to date and bug-free.'
                }
              ],
              faqs: [
                {
                  question: 'Which platforms do you develop apps for?',
                  answer:
                    'We develop apps for iOS, Android, and cross-platform solutions using technologies like React Native and Flutter.'
                },
                {
                  question: 'Do you provide post-launch support?',
                  answer:
                    'Yes, we offer post-launch support and maintenance to keep your app running smoothly.'
                }
              ]
            },
            {
              name: 'Custom Software Development',
              slug: 'custom-software-development',
              description:
                'Tailor-made software solutions to meet specific business needs.',
              thumbnailImg:
                'https://www.exeideas.com/wp-content/uploads/2018/08/Custom-Software.jpg',
              slides: [
                {
                  text: 'Software Solution',
                  image:
                    'https://www.exeideas.com/wp-content/uploads/2018/08/Custom-Software.jpg'
                },
                {
                  text: 'Customization',
                  image:
                    'https://www.exeideas.com/wp-content/uploads/2018/08/Custom-Software.jpg'
                },
                {
                  text: 'Integration',
                  image:
                    'https://www.exeideas.com/wp-content/uploads/2018/08/Custom-Software.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Custom Software Development service specializes in creating tailor-made software solutions to meet specific business needs.'
                },
                {
                  header: 'Technologies Used',
                  info: 'Our team of experts uses cutting-edge technologies and methodologies to build robust and scalable software.'
                },
                {
                  header: 'Customization',
                  info: 'Every aspect of the software is customized to align with your business processes and objectives.'
                },
                {
                  header: 'Cost',
                  info: 'Pricing varies based on the scope and complexity of the project. Contact us for a personalized quote.'
                },
                {
                  header: 'Delivery Time',
                  info: `The timeline for custom software development depends on the project's size and complexity.`
                },
                {
                  header: 'Support',
                  info: 'We offer ongoing support and maintenance to ensure your software performs optimally.'
                }
              ],
              faqs: [
                {
                  question:
                    'Can you integrate the software with existing systems?',
                  answer:
                    'Yes, we can integrate the custom software with your existing systems and applications to ensure seamless operation.'
                },
                {
                  question: 'Do you provide training for using the software?',
                  answer:
                    'Yes, we offer training sessions to ensure your team can effectively use the custom software.'
                }
              ]
            },
            {
              name: 'Software Consulting',
              slug: 'software-consulting',
              description:
                'Expert advice on software strategies, optimization, and implementation.',
              thumbnailImg:
                'https://www.hvsscorp.com/wp-content/uploads/2020/12/931-consulting_service.jpg',
              slides: [
                {
                  text: 'Expert Advice',
                  image:
                    'https://www.hvsscorp.com/wp-content/uploads/2020/12/931-consulting_service.jpg'
                },
                {
                  text: 'Strategy Optimization',
                  image:
                    'https://www.hvsscorp.com/wp-content/uploads/2020/12/931-consulting_service.jpg'
                },
                {
                  text: 'Implementation Guidance',
                  image:
                    'https://www.hvsscorp.com/wp-content/uploads/2020/12/931-consulting_service.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Software Consulting service provides expert guidance on software strategies, optimization, and implementation.'
                },
                {
                  header: 'Consultants',
                  info: 'Our team of experienced consultants will work closely with you to address your specific software needs.'
                },
                {
                  header: 'Optimization',
                  info: 'We analyze your existing software systems and recommend strategies for optimization and improvement.'
                },
                {
                  header: 'Cost',
                  info: 'The cost of our software consulting services varies based on the scope and complexity of the project. Contact us for a customized quote.'
                },
                {
                  header: 'Delivery Time',
                  info: `The timeline for software consulting depends on the project's requirements and objectives.`
                },
                {
                  header: 'Support',
                  info: 'We offer ongoing support and guidance to ensure the successful implementation of software strategies.'
                }
              ],
              faqs: [
                {
                  question:
                    'Can you help optimize our existing software systems?',
                  answer:
                    'Yes, our consultants specialize in optimizing existing software systems for improved performance and efficiency.'
                },
                {
                  question: 'Do you provide training for software teams?',
                  answer:
                    'Yes, we offer training sessions for software teams to enhance their skills and knowledge.'
                }
              ]
            },
            {
              name: 'Cloud Services',
              slug: 'cloud-services',
              description:
                'Services related to cloud computing, including storage and cloud-based application development.',
              thumbnailImg:
                'https://netdepot.com/wp-content/uploads/2020/09/best-cloud-servers.jpeg',
              slides: [
                {
                  text: 'Cloud Computing',
                  image:
                    'https://netdepot.com/wp-content/uploads/2020/09/best-cloud-servers.jpeg'
                },
                {
                  text: 'Storage Solutions',
                  image:
                    'https://netdepot.com/wp-content/uploads/2020/09/best-cloud-servers.jpeg'
                },
                {
                  text: 'Cloud Development',
                  image:
                    'https://netdepot.com/wp-content/uploads/2020/09/best-cloud-servers.jpeg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Cloud Services encompass a wide range of offerings related to cloud computing, including cloud-based storage solutions and cloud application development.'
                },
                {
                  header: 'Cloud Computing',
                  info: 'We provide cloud infrastructure and services that enable businesses to scale and innovate without the need for physical hardware.'
                },
                {
                  header: 'Storage Solutions',
                  info: 'Our cloud storage solutions offer secure, scalable, and cost-effective storage for your data and applications.'
                },
                {
                  header: 'Cloud Development',
                  info: 'Our cloud development services help businesses build and deploy cloud-native applications and services.'
                },
                {
                  header: 'Pricing',
                  info: 'Pricing for our cloud services varies based on the specific service and your business requirements. Contact us for a customized quote.'
                },
                {
                  header: 'Service Time',
                  info: 'The time required for cloud services depends on the complexity of the project and your specific needs.'
                },
                {
                  header: 'Support',
                  info: 'We offer ongoing support and management to ensure the optimal performance of your cloud-based solutions.'
                }
              ],
              faqs: [
                {
                  question:
                    'Can you migrate our existing applications to the cloud?',
                  answer:
                    'Yes, we can help migrate your existing applications to cloud infrastructure for improved flexibility and scalability.'
                },
                {
                  question: 'Do you provide cloud security services?',
                  answer:
                    'Yes, we offer cloud security services to protect your data and applications in the cloud environment.'
                }
              ]
            },
            {
              name: 'UI/UX Design',
              slug: 'ui-ux-design',
              description:
                'Designing user interfaces and experiences for software and digital products.',
              thumbnailImg:
                'https://cdn.educba.com/academy/wp-content/uploads/2020/03/Software-Design.jpg',
              slides: [
                {
                  text: 'User Interface',
                  image:
                    'https://cdn.educba.com/academy/wp-content/uploads/2020/03/Software-Design.jpg'
                },
                {
                  text: 'User Experience',
                  image:
                    'https://cdn.educba.com/academy/wp-content/uploads/2020/03/Software-Design.jpg'
                },
                {
                  text: 'Design Process',
                  image:
                    'https://cdn.educba.com/academy/wp-content/uploads/2020/03/Software-Design.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our UI/UX Design service focuses on creating user-friendly and visually appealing interfaces and experiences for software and digital products.'
                },
                {
                  header: 'User Interface (UI) Design',
                  info: 'We design intuitive and visually appealing user interfaces that enhance user interactions and satisfaction.'
                },
                {
                  header: 'User Experience (UX) Design',
                  info: 'Our UX design ensures that your software or digital product provides a seamless and enjoyable user experience.'
                },
                {
                  header: 'Design Process',
                  info: 'Our design process involves user research, wireframing, prototyping, and iterative design to deliver high-quality UI/UX solutions.'
                },
                {
                  header: 'Cost',
                  info: 'The cost of our UI/UX design services varies based on the project scope and complexity. Contact us for a customized quote.'
                },
                {
                  header: 'Delivery Time',
                  info: 'The delivery time for UI/UX design projects depends on the specific requirements and project size.'
                },
                {
                  header: 'Support',
                  info: 'We provide ongoing support to ensure the successful implementation of our UI/UX designs.'
                }
              ],
              faqs: [
                {
                  question: 'Can you redesign our existing user interface?',
                  answer:
                    'Yes, we can redesign and improve existing user interfaces to enhance user satisfaction and usability.'
                },
                {
                  question:
                    'What tools and technologies do you use for UI/UX design?',
                  answer:
                    'We use industry-standard design tools and methodologies to create UI/UX designs, including Adobe XD, Sketch, Figma, and more.'
                }
              ]
            },
            {
              name: 'Software Testing',
              slug: 'software-testing',
              description:
                'Expert testing using the latest and best tools and software.',
              thumbnailImg:
                'https://fixingblog.com/wp-content/uploads/2021/06/AdobeStock_257701717-scaled.jpeg',
              slides: [
                {
                  text: 'Quality Assurance',
                  image:
                    'https://fixingblog.com/wp-content/uploads/2021/06/AdobeStock_257701717-scaled.jpeg'
                },
                {
                  text: 'Test Automation',
                  image:
                    'https://fixingblog.com/wp-content/uploads/2021/06/AdobeStock_257701717-scaled.jpeg'
                },
                {
                  text: 'Bug Tracking',
                  image:
                    'https://fixingblog.com/wp-content/uploads/2021/06/AdobeStock_257701717-scaled.jpeg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Software Testing service provides expert testing using the latest and best tools and software to ensure the quality and reliability of your software applications.'
                },
                {
                  header: 'Quality Assurance',
                  info: 'We conduct rigorous quality assurance testing to identify and eliminate defects and issues in your software.'
                },
                {
                  header: 'Test Automation',
                  info: 'Our test automation services streamline testing processes, increase efficiency, and reduce testing time.'
                },
                {
                  header: 'Bug Tracking',
                  info: `We use advanced bug tracking systems to monitor and address issues, ensuring the software's stability.`
                },
                {
                  header: 'Pricing',
                  info: 'The pricing for our software testing services varies based on the complexity of the software and the testing requirements. Contact us for a customized quote.'
                },
                {
                  header: 'Testing Time',
                  info: 'The testing time depends on the scope of testing and the size of the software application.'
                },
                {
                  header: 'Support',
                  info: 'We offer ongoing support to resolve any issues identified during testing and to ensure a reliable software product.'
                }
              ],
              faqs: [
                {
                  question: 'Do you perform manual and automated testing?',
                  answer:
                    'Yes, we offer both manual and automated testing services, depending on the project requirements.'
                },
                {
                  question:
                    'Can you provide testing reports and documentation?',
                  answer:
                    'Yes, we provide detailed testing reports and documentation for transparency and quality assurance purposes.'
                }
              ]
            }
          ],
          thumbnailImg:
            'https://www.flexsin.com/blog/wp-content/uploads/2019/12/Custom-Software-Development.jpg'
        },
        {
          name: 'Photography',
          slug: 'photography',
          services: [
            {
              name: 'Wedding Photography',
              slug: 'wedding-photography',
              description:
                'Capturing memorable moments and ceremonies of weddings.',
              thumbnailImg:
                'https://www.seanleblancphotography.com/wp-content/uploads/2019/01/Sean-LeBlanc-Photography-Best-Wedding-Photographs-of-2018-19.jpg',
              slides: [
                {
                  text: 'Memorable Moments',
                  image:
                    'https://www.seanleblancphotography.com/wp-content/uploads/2019/01/Sean-LeBlanc-Photography-Best-Wedding-Photographs-of-2018-19.jpg'
                },
                {
                  text: 'Ceremony',
                  image:
                    'https://www.seanleblancphotography.com/wp-content/uploads/2019/01/Sean-LeBlanc-Photography-Best-Wedding-Photographs-of-2018-19.jpg'
                },
                {
                  text: 'Reception',
                  image:
                    'https://www.seanleblancphotography.com/wp-content/uploads/2019/01/Sean-LeBlanc-Photography-Best-Wedding-Photographs-of-2018-19.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Wedding Photography service specializes in capturing the memorable moments and ceremonies of weddings to create lasting memories.'
                },
                {
                  header: 'Experienced Photographers',
                  info: 'Our team of skilled photographers specializes in wedding photography, ensuring that every moment is beautifully documented.'
                },
                {
                  header: 'Packages',
                  info: 'We offer customizable photography packages to suit your specific wedding photography needs.'
                },
                {
                  header: 'Delivery Time',
                  info: 'We provide edited photos within a few weeks of your wedding day.'
                },
                {
                  header: 'Additional Services',
                  info: 'Ask us about engagement sessions and pre-wedding shoots.'
                },
                {
                  header: 'Albums and Prints',
                  info: 'We offer high-quality albums and prints to preserve your wedding memories.'
                }
              ],
              faqs: [
                {
                  question: 'Do you offer destination wedding photography?',
                  answer:
                    'Yes, we are available for destination weddings. Contact us for more information.'
                },
                {
                  question: 'Can we customize our wedding photography package?',
                  answer:
                    'Absolutely! We tailor our packages to your specific requirements.'
                }
              ]
            },
            {
              name: 'Portrait Photography',
              slug: 'portrait-photography',
              description: 'Photographic portraits of individuals or groups.',
              thumbnailImg:
                'https://blog.hahnemuehle.com/en/wp-content/uploads/sites/12/2015/07/Benedict-Cumberbatch-C-Mark-Mann.jpg',
              slides: [
                {
                  text: 'Individual Portraits',
                  image:
                    'https://blog.hahnemuehle.com/en/wp-content/uploads/sites/12/2015/07/Benedict-Cumberbatch-C-Mark-Mann.jpg'
                },
                {
                  text: 'Group Portraits',
                  image:
                    'https://blog.hahnemuehle.com/en/wp-content/uploads/sites/12/2015/07/Benedict-Cumberbatch-C-Mark-Mann.jpg'
                },
                {
                  text: 'Studio Photography',
                  image:
                    'https://blog.hahnemuehle.com/en/wp-content/uploads/sites/12/2015/07/Benedict-Cumberbatch-C-Mark-Mann.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Portrait Photography service specializes in capturing photographic portraits of individuals or groups, creating beautiful and timeless images.'
                },
                {
                  header: 'Photographic Portraits',
                  info: `We excel in capturing the essence and personality of our subjects, whether it's individual or group portraits.`
                },
                {
                  header: 'Studio Photography',
                  info: 'Our studio photography sessions offer a controlled environment for capturing stunning and professionally lit portraits.'
                },
                {
                  header: 'Location Shoots',
                  info: 'We also offer on-location portrait photography sessions, allowing you to choose your preferred backdrop.'
                },
                {
                  header: 'Pricing',
                  info: 'Pricing for portrait photography varies based on the type of session and your specific requirements. Contact us for a customized quote.'
                },
                {
                  header: 'Delivery Time',
                  info: 'We provide edited portrait photos within a few weeks of the photography session.'
                },
                {
                  header: 'Prints and Digital Files',
                  info: 'You can choose to receive high-quality prints or digital files of your portrait photos.'
                }
              ],
              faqs: [
                {
                  question: 'Do you offer family portrait sessions?',
                  answer:
                    'Yes, we offer family portrait sessions to capture beautiful moments with your loved ones.'
                },
                {
                  question:
                    'Can I request specific poses or styles for my portrait?',
                  answer:
                    'Absolutely! We welcome your ideas and preferences to create personalized and unique portraits.'
                }
              ]
            },
            // Add the slug attribute for the remaining services
            {
              name: 'Event Photography',
              slug: 'event-photography',
              description:
                'Photography services for various events and functions.',
              thumbnailImg:
                'https://i.pinimg.com/originals/09/bb/98/09bb9824e838dc7e8c8a1e9e90c15eba.jpg',
              slides: [
                {
                  text: 'Special Events',
                  image:
                    'https://i.pinimg.com/originals/09/bb/98/09bb9824e838dc7e8c8a1e9e90c15eba.jpg'
                },
                {
                  text: 'Corporate Functions',
                  image:
                    'https://i.pinimg.com/originals/09/bb/98/09bb9824e838dc7e8c8a1e9e90c15eba.jpg'
                },
                {
                  text: 'Social Gatherings',
                  image:
                    'https://i.pinimg.com/originals/09/bb/98/09bb9824e838dc7e8c8a1e9e90c15eba.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Event Photography service offers professional photography services for various events and functions, ensuring that every moment is captured beautifully.'
                },
                {
                  header: 'Versatility',
                  info: 'We have experience covering a wide range of events, including special occasions, corporate functions, and social gatherings.'
                },
                {
                  header: 'Experienced Photographers',
                  info: 'Our team of skilled photographers is adept at capturing the essence and excitement of any event.'
                },
                {
                  header: 'Custom Packages',
                  info: 'We offer customizable photography packages tailored to the specific needs and scale of your event.'
                },
                {
                  header: 'Delivery Time',
                  info: 'We provide edited event photos within a reasonable timeframe after the event.'
                },
                {
                  header: 'Prints and Digital Files',
                  info: 'You can choose to receive high-quality prints or digital files of your event photos.'
                }
              ],
              faqs: [
                {
                  question: 'Do you offer videography services for events?',
                  answer:
                    'Yes, we provide both photography and videography services to capture the complete essence of your event.'
                },
                {
                  question: 'Can you cover outdoor events?',
                  answer:
                    'Absolutely! We are equipped to cover outdoor events and ensure stunning photography even in varying conditions.'
                }
              ]
            },
            {
              name: 'Commercial Photography',
              slug: 'commercial-photography',
              description:
                'Professional photography for commercial purposes, including advertising and product placements.',
              thumbnailImg:
                'https://1.bp.blogspot.com/-2Vps8d4K_Yg/XvH3romk9lI/AAAAAAAAAE8/pM8U8htSY9U9L-boqBRtuUZ8dISnGMZ6wCK4BGAsYHg/s1765/Commercial%2BPhotography%2B4.jpg',
              slides: [
                {
                  text: 'Advertising Photography',
                  image:
                    'https://1.bp.blogspot.com/-2Vps8d4K_Yg/XvH3romk9lI/AAAAAAAAAE8/pM8U8htSY9U9L-boqBRtuUZ8dISnGMZ6wCK4BGAsYHg/s1765/Commercial%2BPhotography%2B4.jpg'
                },
                {
                  text: 'Product Photography',
                  image:
                    'https://1.bp.blogspot.com/-2Vps8d4K_Yg/XvH3romk9lI/AAAAAAAAAE8/pM8U8htSY9U9L-boqBRtuUZ8dISnGMZ6wCK4BGAsYHg/s1765/Commercial%2BPhotography%2B4.jpg'
                },
                {
                  text: 'Corporate Imagery',
                  image:
                    'https://1.bp.blogspot.com/-2Vps8d4K_Yg/XvH3romk9lI/AAAAAAAAAE8/pM8U8htSY9U9L-boqBRtuUZ8dISnGMZ6wCK4BGAsYHg/s1765/Commercial%2BPhotography%2B4.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Commercial Photography service provides professional photography for commercial purposes, including advertising, product placements, and corporate imagery.'
                },
                {
                  header: 'Advertising Photography',
                  info: 'We specialize in creating striking and attention-grabbing visuals for advertising campaigns.'
                },
                {
                  header: 'Product Photography',
                  info: 'Our product photography showcases your products in the best light, making them more appealing to customers.'
                },
                {
                  header: 'Corporate Imagery',
                  info: 'We capture professional corporate imagery, including headshots and office environment photography, to enhance your brand image.'
                },
                {
                  header: 'Customized Packages',
                  info: 'We offer customized photography packages tailored to your specific commercial photography needs.'
                },
                {
                  header: 'Delivery Time',
                  info: 'We provide professionally edited commercial photos within a reasonable timeframe.'
                },
                {
                  header: 'Licensing',
                  info: 'You will receive the necessary licensing rights for the use of commercial photos in your advertising and promotional materials.'
                }
              ],
              faqs: [
                {
                  question:
                    'Do you provide location-based commercial photography?',
                  answer:
                    'Yes, we can conduct commercial photography on location to showcase your products or services in their natural environment.'
                },
                {
                  question:
                    'Can you photograph products for e-commerce websites?',
                  answer:
                    'Certainly! We specialize in product photography for e-commerce websites, ensuring high-quality visuals for your online store.'
                }
              ]
            },
            {
              name: 'Landscape Photography',
              slug: 'landscape-photography',
              description:
                'Capturing natural and urban landscapes in photographic art.',
              thumbnailImg:
                'https://tse1.mm.bing.net/th?id=OIP.L4nUSvQ7ZaefejVVEkLG5QHaEp&pid=Api&P=0&h=180',
              slides: [
                {
                  text: 'Natural Landscapes',
                  image:
                    'https://tse1.mm.bing.net/th?id=OIP.L4nUSvQ7ZaefejVVEkLG5QHaEp&pid=Api&P=0&h=180'
                },
                {
                  text: 'Urban Landscapes',
                  image:
                    'https://tse1.mm.bing.net/th?id=OIP.L4nUSvQ7ZaefejVVEkLG5QHaEp&pid=Api&P=0&h=180'
                },
                {
                  text: 'Scenic Beauty',
                  image:
                    'https://tse1.mm.bing.net/th?id=OIP.L4nUSvQ7ZaefejVVEkLG5QHaEp&pid=Api&P=0&h=180'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Landscape Photography service specializes in capturing the beauty of natural and urban landscapes, creating stunning photographic art.'
                },
                {
                  header: 'Natural Landscapes',
                  info: 'We capture the awe-inspiring beauty of natural landscapes, from majestic mountains to serene beaches.'
                },
                {
                  header: 'Urban Landscapes',
                  info: 'Our urban landscape photography showcases the vibrant and dynamic aspects of cityscapes and architecture.'
                },
                {
                  header: 'Scenic Beauty',
                  info: 'We focus on capturing the scenic beauty of landscapes, providing you with captivating photographic art for your spaces.'
                },
                {
                  header: 'Prints and Wall Art',
                  info: 'You can choose to receive high-quality prints and wall art of our landscape photography to adorn your living or workspaces.'
                },
                {
                  header: 'Customization',
                  info: 'Customize the size and framing options of your landscape photography prints to suit your preferences.'
                },
                {
                  header: 'Delivery Time',
                  info: 'We provide professionally edited landscape photos for printing within a reasonable timeframe.'
                }
              ],
              faqs: [
                {
                  question:
                    'Do you offer limited edition prints of landscape photographs?',
                  answer:
                    'Yes, we offer limited edition prints of our most stunning landscape photographs for collectors and art enthusiasts.'
                },
                {
                  question:
                    'Can I request specific landscape locations for photography?',
                  answer:
                    'Certainly! We can discuss your preferences and plan landscape photography sessions at your desired locations.'
                }
              ]
            },
            {
              name: 'Travel Photography',
              slug: 'travel-photography',
              description:
                'Photography that captures the essence of a place and its culture during travels.',
              thumbnailImg:
                'http://travelingcanucks.com/wp-content/uploads/2017/05/Traveling_Canucks_Travel_Photography_005.jpg',
              slides: [
                {
                  text: 'Cultural Exploration',
                  image:
                    'http://travelingcanucks.com/wp-content/uploads/2017/05/Traveling_Canucks_Travel_Photography_005.jpg'
                },
                {
                  text: 'Landscape Discovery',
                  image:
                    'http://travelingcanucks.com/wp-content/uploads/2017/05/Traveling_Canucks_Travel_Photography_005.jpg'
                },
                {
                  text: 'Local Life',
                  image:
                    'http://travelingcanucks.com/wp-content/uploads/2017/05/Traveling_Canucks_Travel_Photography_005.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Travel Photography service captures the essence of a place and its culture during your travels, creating evocative and memorable visuals.'
                },
                {
                  header: 'Cultural Exploration',
                  info: 'We document the rich cultural experiences and traditions encountered during your travels.'
                },
                {
                  header: 'Landscape Discovery',
                  info: 'Our travel photography showcases the breathtaking landscapes and natural beauty of the places you visit.'
                },
                {
                  header: 'Local Life',
                  info: 'We delve into the daily lives of locals, offering a unique perspective on the destinations you explore.'
                },
                {
                  header: 'Customized Travel Packages',
                  info: 'We offer customized travel photography packages to cover specific destinations or travel experiences.'
                },
                {
                  header: 'Travel Albums',
                  info: 'Create lasting memories with beautifully designed travel photo albums capturing your adventures.'
                },
                {
                  header: 'Delivery Time',
                  info: 'We provide professionally edited travel photos within a reasonable timeframe.'
                }
              ],
              faqs: [
                {
                  question:
                    'Can you accompany us on our travels to capture moments?',
                  answer:
                    'Yes, we can travel with you to document your journey and create stunning travel photography.'
                },
                {
                  question:
                    'Do you provide high-resolution digital files of travel photos?',
                  answer:
                    'Absolutely! You will receive high-resolution digital files for personal and online use.'
                }
              ]
            }
          ],
          thumbnailImg:
            'http://foreverphotographychicago.com/wp-content/uploads/2014/11/studio-shoot.jpg'
        },
        {
          name: 'Videography',
          slug: 'videography',
          services: [
            {
              name: 'Wedding Videography',
              slug: 'wedding-videography',
              description: 'Recording and producing videos of wedding events.',
              thumbnailImg:
                'https://www.seanleblancphotography.com/wp-content/uploads/2019/01/Sean-LeBlanc-Photography-Best-Wedding-Photographs-of-2018-19.jpg',
              slides: [
                {
                  text: 'Wedding Moments',
                  image:
                    'https://www.seanleblancphotography.com/wp-content/uploads/2019/01/Sean-LeBlanc-Photography-Best-Wedding-Photographs-of-2018-19.jpg'
                },
                {
                  text: 'Ceremonies',
                  image:
                    'https://www.seanleblancphotography.com/wp-content/uploads/2019/01/Sean-LeBlanc-Photography-Best-Wedding-Photographs-of-2018-19.jpg'
                },
                {
                  text: 'Receptions',
                  image:
                    'https://www.seanleblancphotography.com/wp-content/uploads/2019/01/Sean-LeBlanc-Photography-Best-Wedding-Photographs-of-2018-19.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Wedding Videography service specializes in recording and producing beautiful videos that capture the magic and memories of wedding events.'
                },
                {
                  header: 'Professional Videographers',
                  info: 'Our team of skilled videographers is dedicated to capturing every precious moment of your wedding day.'
                },
                {
                  header: 'Cinematic Storytelling',
                  info: 'We create cinematic wedding videos that tell the unique story of your love and celebration.'
                },
                {
                  header: 'Customized Packages',
                  info: 'We offer customized videography packages to suit your specific wedding video needs.'
                },
                {
                  header: 'Video Editing',
                  info: 'Our video editing ensures that your wedding video is a polished and beautiful reflection of your special day.'
                },
                {
                  header: 'Delivery Time',
                  info: `You'll receive your edited wedding video within a reasonable timeframe after your wedding.`
                },
                {
                  header: 'Formats',
                  info: 'We provide wedding videos in various formats, including digital files and DVDs.'
                }
              ],
              faqs: [
                {
                  question: 'Do you offer drone videography for weddings?',
                  answer:
                    'Yes, we offer drone videography to capture stunning aerial views of your wedding venue.'
                },
                {
                  question:
                    'Can we request specific songs or music for our wedding video?',
                  answer:
                    'Absolutely! We can include your preferred songs and music to personalize your wedding video.'
                }
              ]
            },
            {
              name: 'Commercial Videography',
              slug: 'commercial-videography',
              description:
                'Creating videos for commercial and advertising purposes.',
              thumbnailImg:
                'https://1.bp.blogspot.com/-2Vps8d4K_Yg/XvH3romk9lI/AAAAAAAAAE8/pM8U8htSY9U9L-boqBRtuUZ8dISnGMZ6wCK4BGAsYHg/s1765/Commercial%2BPhotography%2B4.jpg',
              slides: [
                {
                  text: 'Advertising Videos',
                  image:
                    'https://1.bp.blogspot.com/-2Vps8d4K_Yg/XvH3romk9lI/AAAAAAAAAE8/pM8U8htSY9U9L-boqBRtuUZ8dISnGMZ6wCK4BGAsYHg/s1765/Commercial%2BPhotography%2B4.jpg'
                },
                {
                  text: 'Product Promotions',
                  image:
                    'https://1.bp.blogspot.com/-2Vps8d4K_Yg/XvH3romk9lI/AAAAAAAAAE8/pM8U8htSY9U9L-boqBRtuUZ8dISnGMZ6wCK4BGAsYHg/s1765/Commercial%2BPhotography%2B4.jpg'
                },
                {
                  text: 'Corporate Videos',
                  image:
                    'https://1.bp.blogspot.com/-2Vps8d4K_Yg/XvH3romk9lI/AAAAAAAAAE8/pM8U8htSY9U9L-boqBRtuUZ8dISnGMZ6wCK4BGAsYHg/s1765/Commercial%2BPhotography%2B4.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Commercial Videography service specializes in creating impactful videos for commercial and advertising purposes, including product promotions and corporate videos.'
                },
                {
                  header: 'Advertising Videos',
                  info: 'We produce attention-grabbing advertising videos that effectively convey your message to your target audience.'
                },
                {
                  header: 'Product Promotions',
                  info: 'Our product promotion videos highlight the features and benefits of your products to boost sales and engagement.'
                },
                {
                  header: 'Corporate Videos',
                  info: 'We create professional corporate videos for internal and external communication, training, and marketing.'
                },
                {
                  header: 'Customized Video Packages',
                  info: 'We offer customized videography packages tailored to your specific commercial video needs.'
                },
                {
                  header: 'Video Editing and Post-Production',
                  info: 'Our video editing and post-production services ensure that your commercial videos are polished and impactful.'
                },
                {
                  header: 'Delivery Time',
                  info: `You'll receive your edited commercial videos within a reasonable timeframe.`
                },
                {
                  header: 'Formats',
                  info: 'We provide commercial videos in various formats suitable for online and offline use.'
                }
              ],
              faqs: [
                {
                  question:
                    'Do you offer scriptwriting services for commercial videos?',
                  answer:
                    'Yes, we can provide scriptwriting services to create compelling narratives for your commercial videos.'
                },
                {
                  question: 'Can you shoot commercial videos on location?',
                  answer:
                    'Certainly! We can conduct on-location shoots to capture the essence of your business or products.'
                }
              ]
            },
            // Add the slug attribute for the remaining services
            {
              name: 'Documentary Production',
              slug: 'documentary-production',
              description:
                'Producing documentary films to explore real-life stories or issues.',
              thumbnailImg:
                'https://www.filmindependent.org/wp-content/uploads/2017/09/unnamed-9.jpg',
              slides: [
                {
                  text: 'Real-Life Stories',
                  image:
                    'https://www.filmindependent.org/wp-content/uploads/2017/09/unnamed-9.jpg'
                },
                {
                  text: 'Social Issues',
                  image:
                    'https://www.filmindependent.org/wp-content/uploads/2017/09/unnamed-9.jpg'
                },
                {
                  text: 'In-Depth Exploration',
                  image:
                    'https://www.filmindependent.org/wp-content/uploads/2017/09/unnamed-9.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Documentary Production service specializes in producing compelling documentary films that delve into real-life stories, issues, and in-depth exploration of various subjects.'
                },
                {
                  header: 'Real-Life Stories',
                  info: 'We capture and narrate real-life stories that inspire, educate, and entertain audiences.'
                },
                {
                  header: 'Social Issues',
                  info: 'Our documentaries shed light on important social issues, raising awareness and encouraging discussions.'
                },
                {
                  header: 'In-Depth Exploration',
                  info: 'We take viewers on a journey of in-depth exploration, providing unique perspectives on various subjects.'
                },
                {
                  header: 'Customized Documentary Projects',
                  info: 'We offer customized documentary production services to bring your vision and stories to life.'
                },
                {
                  header: 'Post-Production Excellence',
                  info: 'Our post-production team ensures the highest quality editing and storytelling for your documentaries.'
                },
                {
                  header: 'Delivery Time',
                  info: `You'll receive your completed documentary within a reasonable timeframe.`
                },
                {
                  header: 'Formats',
                  info: 'We provide documentaries in various formats suitable for broadcast, streaming, and festivals.'
                }
              ],
              faqs: [
                {
                  question:
                    'Can you help with scriptwriting for documentary projects?',
                  answer:
                    'Yes, we offer scriptwriting services to craft compelling narratives for your documentary.'
                },
                {
                  question:
                    'Do you have experience with documentary distribution?',
                  answer:
                    'Certainly! We can assist with documentary distribution strategies to reach a wider audience.'
                }
              ]
            },
            {
              name: 'Event Videography',
              slug: 'event-videography',
              description:
                'Video coverage of various events, including corporate and social events.',
              thumbnailImg:
                'https://i.pinimg.com/originals/09/bb/98/09bb9824e838dc7e8c8a1e9e90c15eba.jpg',
              slides: [
                {
                  text: 'Corporate Events',
                  image:
                    'https://i.pinimg.com/originals/09/bb/98/09bb9824e838dc7e8c8a1e9e90c15eba.jpg'
                },
                {
                  text: 'Social Gatherings',
                  image:
                    'https://i.pinimg.com/originals/09/bb/98/09bb9824e838dc7e8c8a1e9e90c15eba.jpg'
                },
                {
                  text: 'Special Occasions',
                  image:
                    'https://i.pinimg.com/originals/09/bb/98/09bb9824e838dc7e8c8a1e9e90c15eba.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Event Videography service offers comprehensive video coverage of various events, including corporate functions, social gatherings, and special occasions.'
                },
                {
                  header: 'Corporate Events',
                  info: 'We specialize in capturing the essence of corporate events, conferences, and business meetings.'
                },
                {
                  header: 'Social Gatherings',
                  info: 'Our videographers are skilled at documenting social gatherings, parties, and celebrations.'
                },
                {
                  header: 'Special Occasions',
                  info: 'We record the magic of special occasions such as weddings, anniversaries, and milestone events.'
                },
                {
                  header: 'Customized Videography Packages',
                  info: 'We offer customized event videography packages tailored to your specific event video needs.'
                },
                {
                  header: 'Professional Editing',
                  info: 'Our team ensures professional video editing to create a captivating narrative of your event.'
                },
                {
                  header: 'Delivery Time',
                  info: `You'll receive your edited event videos within a reasonable timeframe.`
                },
                {
                  header: 'Formats',
                  info: 'We provide event videos in various formats suitable for online sharing and archival purposes.'
                }
              ],
              faqs: [
                {
                  question: 'Can you cover events in multiple locations?',
                  answer:
                    'Yes, we can provide event videography services at multiple locations to capture all aspects of your event.'
                },
                {
                  question: 'Do you offer live streaming of events?',
                  answer:
                    'Certainly! We can arrange live streaming services to broadcast your event in real-time.'
                }
              ]
            },
            {
              name: 'Corporate Videography',
              slug: 'corporate-videography',
              description:
                'Producing videos for corporate communication, training, and marketing.',
              thumbnailImg:
                'https://fewstones.com/wp-content/uploads/2019/12/cameraman-and-middle-aged-businessman-making-PQLKDFT.jpg',
              slides: [
                {
                  text: 'Corporate Communication',
                  image:
                    'https://fewstones.com/wp-content/uploads/2019/12/cameraman-and-middle-aged-businessman-making-PQLKDFT.jpg'
                },
                {
                  text: 'Training Videos',
                  image:
                    'https://fewstones.com/wp-content/uploads/2019/12/cameraman-and-middle-aged-businessman-making-PQLKDFT.jpg'
                },
                {
                  text: 'Marketing Materials',
                  image:
                    'https://fewstones.com/wp-content/uploads/2019/12/cameraman-and-middle-aged-businessman-making-PQLKDFT.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Corporate Videography service specializes in producing professional videos for corporate communication, training, and marketing purposes.'
                },
                {
                  header: 'Corporate Communication',
                  info: 'We create corporate videos that effectively convey your company’s messages to internal and external audiences.'
                },
                {
                  header: 'Training Videos',
                  info: 'Our training videos help streamline employee onboarding and education through engaging and informative content.'
                },
                {
                  header: 'Marketing Materials',
                  info: 'We produce marketing videos that promote your products, services, and brand, helping you reach a wider audience.'
                },
                {
                  header: 'Customized Corporate Video Packages',
                  info: 'We offer customized videography packages tailored to your specific corporate video needs.'
                },
                {
                  header: 'Professional Editing and Post-Production',
                  info: 'Our video editing and post-production services ensure that your corporate videos are polished and impactful.'
                },
                {
                  header: 'Delivery Time',
                  info: `You'll receive your edited corporate videos within a reasonable timeframe.`
                },
                {
                  header: 'Formats',
                  info: 'We provide corporate videos in various formats suitable for presentations, online sharing, and marketing campaigns.'
                }
              ],
              faqs: [
                {
                  question: 'Can you create multilingual corporate videos?',
                  answer:
                    'Yes, we can produce corporate videos in multiple languages to cater to diverse audiences.'
                },
                {
                  question:
                    'Do you offer on-location shooting for corporate videos?',
                  answer:
                    'Certainly! We can conduct on-location shoots to capture the essence of your corporate environment.'
                }
              ]
            },
            {
              name: 'Music Video Production',
              slug: 'music-video-production',
              description:
                'Creating music videos for artists, bands, and record labels.',
              thumbnailImg:
                'https://s3.amazonaws.com/pbblogassets/uploads/2019/08/01101726/videography-cover.jpg',
              slides: [
                {
                  text: 'Visual Storytelling',
                  image:
                    'https://s3.amazonaws.com/pbblogassets/uploads/2019/08/01101726/videography-cover.jpg'
                },
                {
                  text: 'Creative Direction',
                  image:
                    'https://s3.amazonaws.com/pbblogassets/uploads/2019/08/01101726/videography-cover.jpg'
                },
                {
                  text: 'Artistic Cinematography',
                  image:
                    'https://s3.amazonaws.com/pbblogassets/uploads/2019/08/01101726/videography-cover.jpg'
                }
              ],
              details: [
                {
                  header: 'Description',
                  info: 'Our Music Video Production service is dedicated to creating captivating music videos for artists, bands, and record labels.'
                },
                {
                  header: 'Visual Storytelling',
                  info: 'We specialize in visual storytelling, translating your music into compelling narratives on screen.'
                },
                {
                  header: 'Creative Direction',
                  info: 'Our creative team collaborates closely with you to bring your artistic vision to life in your music video.'
                },
                {
                  header: 'Artistic Cinematography',
                  info: 'We use artistic cinematography techniques to make your music video visually stunning and memorable.'
                },
                {
                  header: 'Customized Music Video Packages',
                  info: 'We offer customized music video production packages tailored to your unique creative needs.'
                },
                {
                  header: 'Video Editing and Post-Production',
                  info: 'Our video editing and post-production services ensure that your music video is polished and ready for release.'
                },
                {
                  header: 'Delivery Time',
                  info: `You'll receive your edited music video within a reasonable timeframe.`
                },
                {
                  header: 'Formats',
                  info: 'We provide music videos in various formats suitable for online streaming, television, and social media.'
                }
              ],
              faqs: [
                {
                  question:
                    'Do you offer concept development for music videos?',
                  answer:
                    'Yes, we can assist in developing creative concepts that align with your music and brand.'
                },
                {
                  question:
                    'Can you provide location scouting for music video shoots?',
                  answer:
                    'Certainly! We can scout locations to match the visual style of your music video.'
                }
              ]
            }
          ],
          thumbnailImg:
            'https://cs3design.com/wp-content/uploads/2020/06/videographer-footer-background.jpg'
        }
      ];

      // Insert categories into the database
      for (const category of sampleCategories) {
        const newCategory = new Category({
          name: category.name,
          slug: category.slug,
          services: category.services,
          thumbnailImg: category.thumbnailImg
        });

        await newCategory.save();
      }

      console.log('Sample categories have been created and inserted.');
    } catch (error) {
      console.error('Error creating and inserting sample categories:', error);
    }
  }
}

const db = new Database();
db.run();
