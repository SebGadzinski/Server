/**
 * @file Notification Unit Tests For Services
 * @author Sebastian Gadzinski
 */

import path from 'path';
import { By, Key, TimeUnit, until } from 'selenium-webdriver';
import SelenuimTest from '../bases/SelenuimTest';
import config from '../../src/config';
import { Category, Work } from '../../src/models';

class ToAlignable extends SelenuimTest {
    constructor() {
        super();
        this.run();
    }

    run() {
        describe("Export Data To Alignable", () => {
            before(async () => {
                await this.initiateDriver();
                await this.startMongo(false);
                await this.d.manage().setTimeouts({ implicit: 5000 });
            });

            it('Login', async () => {
                await this.d.get("https://www.alignable.com/biz_users/sign_in");
                await this.d.findElement(By.id('biz_user_email')).sendKeys(config.alignable.email);
                await this.d.findElement(By.css('input[type="submit"]')).click();
                await this.d.wait(until.elementLocated(By.id('biz_user_password')), 5000);
                await this.d.findElement(By.id('biz_user_password')).sendKeys(config.alignable.password);
                await this.d.findElement(By.css('input[type="submit"]')).click();
            });
            it('Goes To Profile', async () => {
                await this.d.wait(until.elementLocated(By.xpath('/html/body/div[1]/div/header/nav/div/div/div[2]/div[3]/div[1]/div[7]/button')), 5000);
                await this.d.findElement(
                    By.xpath("/html/body/div[1]/div/header/nav/div/div/div[2]/div[3]/div[1]/div[7]/button")
                ).click();
                await this.d.findElement(
                    By.xpath("/html/body/div[1]/div/header/nav/div/div/div[2]/div[3]/div[1]/div[7]/div[2]/nav/div/div/div/a[1]")
                ).click();
            });
            it('Add Missing Category Product', async () => {
                await this.d.wait(until.elementLocated(By.css("#products-and-services-block > div > div.profile-block-services__header > a")), 5000);
                await this.d.findElement(
                    By.css("#products-and-services-block > div > div.profile-block-services__header > a")
                ).click();
                const categories = await Category.find({});
                for (const category of categories) {
                    for (const service of category.services) {
                        await this.d.wait(until.elementLocated(By.id("service_name")), 5000);
                        await this.d.findElement(By.id("service_name")).sendKeys(`gadzy-work.com/${category.slug}/${service.slug}`, Key.TAB);

                        // Description
                        let editorDiv = await this.d.findElement(By.css('.forum-post-editor'));
                        await this.d.executeScript("arguments[0].innerHTML = '';", editorDiv);


                        // Set the new content
                        let details = '';
                        for (const detail of service.details) {
                            details += `<p><strong>${detail.header}:</strong></p>`;
                            details += `<p>${detail.info}</p>`;
                        }
                        let formatted = details + `<br/><a href="https://gadzy-work.com/#/${category.slug}/${service.slug}"><button>Go To Site!</button></a>`;

                        // Use JavaScript to set the inner HTML of the editor
                        await this.d.executeScript("arguments[0].innerHTML = arguments[1];", editorDiv, formatted);

                        // Trigger an input event to simulate user input
                        await this.d.executeScript(`
                            var event = new Event('input', {
                                bubbles: true,
                                cancelable: true,
                            });
                            arguments[0].dispatchEvent(event);
                        `, editorDiv);

                        // Update the hidden textarea to keep it in sync with the editor content
                        let textarea = await this.d.findElement(By.id('service_description_html'));
                        await this.d.executeScript("arguments[0].value = arguments[1];", textarea, formatted);

                        // Image
                        // await this.d.findElement(By.css('.image-uploader-preview__button--upload')).click();
                        // const index = `/WorkTemp/Pics/category-service-pics/`;
                        // const fileType = ['software', 'classes', 'design'].some((x) => x === category.slug) ? 'png' : 'JPG';
                        // const formattedThumbnail = service.slides[0].text
                        //     .toLowerCase()
                        //     .replace(/\s+/g, '-'); // Replaces one or more spaces with a single hyphen
                        // const thumbnailFilePath = path.resolve(`${index}${category.slug}/${service.slug}/desktop/${formattedThumbnail}.${fileType}`);
                        // const fileInput = await this.d.findElement(By.css(`input[type="file"]`));
                        // await fileInput.sendKeys(thumbnailFilePath);

                        // // Trigger a change event to simulate file input
                        // await this.d.executeScript(`
                        //     var changeEvent = new Event('input', {
                        //         bubbles: true,
                        //         cancelable: true,
                        //     });
                        //     arguments[0].dispatchEvent(changeEvent);
                        // `, fileInput);

                        await this.d.findElement(By.css('input[value="Create"]')).click();

                        let didComplete = true;
                        try {
                            await this.d.findElement(By.id("service_error_messages"));
                            didComplete = true;
                        } catch (err) { }
                        if (didComplete) {
                            await this.d.navigate().refresh();
                            await this.d.wait(until.elementLocated(By.css("#products-and-services-block > div > div.profile-block-services__header > a")), 5000);
                            await this.d.findElement(
                                By.css("#products-and-services-block > div > div.profile-block-services__header > a")
                            ).click();
                        }
                    }
                }
                await this.d.close();
            })
        });
    }
}

new ToAlignable();
